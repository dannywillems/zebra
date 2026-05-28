---
sidebar_position: 4
title: "Consensus and State"
description: "Checkpoint vs semantic verification, the finalized RocksDB store, the non-finalized fork forest, and rollback rules."
---

# Consensus and State

## Why This Chapter Exists

A consensus bug here splits the chain. The chapter is what separates "I know the format" (chapter 02) from "I can change a verification rule without breaking mainnet". You must leave knowing the difference between checkpoint verification, semantic verification, and what `ReadRequest` vs `Request` actually does in `zebra-state`.

Verification in Zebra is split into three telescoping levels, taken
straight from the module-level doc in `zebra-consensus/src/lib.rs`:

1. structural validity: format and structure. Enforced by the type
   definitions in `zebra-chain`. If you cannot construct it, it is
   not a valid Zcash object.
2. semantic validity: could-be-valid given some chain state. Spend
   proofs verify, signatures verify, value balance is correct. This
   is what `zebra-consensus` enforces.
3. contextual validity: actually valid in the context of a specific
   chain state. UTXO is unspent, nullifier is unrevealed, treestate
   anchor exists. This is what `zebra-state` enforces when blocks
   are committed.

## zebra-consensus

The crate exposes a small public surface (`zebra-consensus/src/lib.rs`):

- `block::{Request, VerifyBlockError, MAX_BLOCK_SIGOPS}`,
- `checkpoint::{VerifyCheckpointError, MAX_CHECKPOINT_BYTE_COUNT,
  MAX_CHECKPOINT_HEIGHT_GAP}`,
- `config::Config`,
- `error::BlockError`,
- `primitives::{ed25519, groth16, halo2, redjubjub, redpallas}`,
- `router::RouterError`,
- `transaction`.

### The Router

`router/` chooses between two verification paths depending on whether
the block height is below the latest checkpoint or above it.

- below the checkpoint: only structural validity plus checkpoint
  hash match is required. Everything else is implied by the
  checkpoint. This is what makes initial block download fast.
- above the checkpoint: full semantic verification (signatures,
  proofs, scripts, sigop counts, value balance, etc.).

Read `router/service_trait.rs` to see how the router exposes itself
as a single Tower service.

### Checkpoint Verification

`checkpoint/` holds the checkpoint table (lifted from
`zebra-chain::parameters::checkpoint`) and the checkpoint verifier.
Two key constants are exported: `MAX_CHECKPOINT_BYTE_COUNT` and
`MAX_CHECKPOINT_HEIGHT_GAP`, which bound how many blocks can sit
between checkpoints.

The verifier checks PoW (Equihash plus difficulty target plus the
chain history root contribution) and the checkpoint hash. It does not
verify scripts, signatures, or shielded proofs.

There is a generator tool under `zebra-utils/` named
`zebra-checkpoints` that builds the checkpoint table by walking an
already-synced state.

### Block Verification (Full Path)

`block/check.rs` implements the per-block semantic checks: header
checks, time bounds, difficulty target, coinbase rules, subsidy,
sigop limit, version checks, transparent input/output well-formedness,
etc. `block/subsidy/` computes the per-height block subsidy and the
funding-stream payouts (FRs since Canopy, then NSM since NU6).

`MAX_BLOCK_SIGOPS` is exported. The "what counts as a sigop" rule
matches zcashd's `GetLegacySigOpCount + GetP2SHSigOpCount`. The
matching code is in `zebra-script/src/lib.rs` (see `Sigops` trait
and `p2sh_sigop_count`).

### Transaction Verification

`transaction/` implements the per-transaction semantic checks as a
Tower service. The service:

- pulls every previous output the transaction spends from
  `zebra-state` (via `AwaitUtxo` requests),
- builds a `CachedFfiTransaction` and dispatches script verifications
  to the script verifier batch,
- dispatches shielded proof verifications to the Groth16 / Halo2
  verifiers,
- dispatches signature verifications to Ed25519, RedJubjub,
  RedPallas verifiers,
- enforces ZIP-244 sighash / authdigest / txid as needed,
- checks value balance and binding signatures,
- waits for all of these to resolve and returns a single result.

Each spawned subtask is itself a Tower service call, batched by
`tower-batch-control`. This is the structural reason Zebra is faster
than zcashd at verification: every cryptographic check is batched and
parallelized.

### Primitives (Verifier Services)

`primitives/` contains the verifier services for the cryptography
listed in `03-cryptography.md`. Each follows the same pattern:

1. an item type representing one verification (signature + message,
   or proof + statement),
2. a batch type that accumulates items,
3. a Tower service that exposes a `verify(item)` request and uses
   `tower-batch-control` to drain the queue,
4. a fallback per-item service used by `tower-fallback` on batch
   failure.

`primitives/sapling.rs` is the Sapling-specific glue. `groth16/`
holds the Sapling and Sprout proof verifiers; `halo2.rs` holds the
Orchard proof verifier; `ed25519/`, `redjubjub/`, `redpallas/`
hold the signature verifiers.

Spend the most time on these directories; they are where
cryptographic correctness lives in Zebra proper.

### Script

`script/` is a thin Tower wrapper around `zebra-script`. It
serializes script verifications so a single FFI call is in flight at
a time per input but batches verifications across inputs across a
block.

## zebra-state

The state crate is split into:

- `service/finalized_state/`: the on-disk RocksDB store.
- `service/non_finalized_state/`: in-memory tree of forks above the
  finalized tip.
- `service/chain_tip/`: tip watcher infrastructure (used by every
  other crate that needs to know "what is the tip").
- `service/queued_blocks/`: blocks that arrived before their
  parents.
- `service/pending_utxos.rs`: pending UTXO lookups (the `AwaitUtxo`
  pattern, see RFC 0001).
- `service/check/`: contextual verification.
- `service/read/`: read-only operations.
- `service/write.rs`: the single writer task.

### Finalized vs Non-finalized

A block is "finalized" once it is at least `MAX_BLOCK_REORG_HEIGHT`
(100) blocks below the tip. Below that depth, no reorg is permitted;
above it, Zebra keeps multiple competing forks in memory and chooses
the heaviest.

`finalized_state/` is durable. It uses RocksDB through the
`disk_db/` wrapper. The actual column families and key/value
encoding live in `disk_format/`. Read these in order:

1. `disk_format/` for the on-disk schema (what columns exist, what
   the key and value bytes look like).
2. `disk_db/` for the RocksDB API surface Zebra uses.
3. `zebra_db/` for the typed read/write API.

There is a schema version constant in
`zebra-state/src/constants.rs`. Any change to disk layout requires
bumping it and writing migration code. The dev book has a chapter on
this: `book/src/dev/state-db-upgrades.md`.

### Storage Layout: What Is on Disk

The finalized state is a single RocksDB database living under the
configured cache directory. The layout is fixed by the database
format version and split across many column families. Knowing which
column family does what is the difference between reasoning about a
consensus bug and reasoning about an indexing bug, so this section
spells out the split.

#### Where the Database Lives

The path is computed by `Config::db_path`:

```rust reference title="zebra-state/src/config.rs (db_path)"
https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-state/src/config.rs#L154-L172
```

In practice, on Linux the path is:

```text
~/.cache/zebra/state/v<MAJOR>/<network>/
```

with `<MAJOR>` the current major database format version (constant
in `zebra-state/src/constants.rs`) and `<network>` one of `mainnet`,
`testnet`, `regtest`. The format version is incremented on any
breaking schema change. Forgetting to bump it is the canonical way
to corrupt a user's database on upgrade.

The non-finalized state is **not** on disk at all in normal
operation. It is an in-memory tree of `Chain` objects above the
finalized tip. There is an optional backup directory
(`non_finalized_state/`, alongside `state/`) when
`should_backup_non_finalized_state` is enabled, but reorgs do not
durably persist below that.

#### Column Families, by Purpose

Zebra opens every column family that exists on disk *or* is named
in the current code, so old databases stay readable across version
bumps:

```rust reference title="zebra-state/src/service/finalized_state/disk_db.rs (construct_column_families)"
https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-state/src/service/finalized_state/disk_db.rs#L931-L962
```

The 27 current column families split into three roles. Treat the
boundary as load-bearing: an indexing-only column may be rebuilt
from the protocol-critical ones; a protocol-critical column may
not.

**Protocol-critical (consensus needs these to verify a block).**
Removing or corrupting any of these breaks validation; their
contents are derived from the block stream and are part of the
state-transition function.

| Column family                       | What it stores                                                  |
| ----------------------------------- | --------------------------------------------------------------- |
| `block_header_by_height`            | Serialized block header, keyed by height.                       |
| `block_info`                        | Per-block metadata (size, transaction count, value pool delta). |
| `hash_by_height`, `height_by_hash`  | Bi-directional block hash to height map.                        |
| `tx_by_loc`                         | Full transaction, keyed by a `(height, tx_index)` location.     |
| `utxo_by_out_loc`                   | UTXO set: outputs keyed by `(height, tx_index, output_index)`.  |
| `sprout_nullifiers`                 | Revealed Sprout nullifiers (double-spend defence).              |
| `sapling_nullifiers`                | Revealed Sapling nullifiers (double-spend defence).             |
| `orchard_nullifiers`                | Revealed Orchard nullifiers (double-spend defence).             |
| `sprout_anchors`                    | Sprout anchors -> note commitment tree at that anchor.          |
| `sapling_anchors`                   | Set of Sapling anchors (value is unit).                         |
| `orchard_anchors`                   | Set of Orchard anchors (value is unit).                         |
| `sprout_note_commitment_tree`       | Latest Sprout tree state, for incremental updates.              |
| `sapling_note_commitment_tree`      | Latest Sapling tree state, for incremental updates.             |
| `orchard_note_commitment_tree`      | Latest Orchard tree state, for incremental updates.             |
| `history_tree`                      | The MMR chain history tree (ZIP 221, NU5 and later).            |
| `tip_chain_value_pool`              | Per-pool cumulative balance (the "turnstile" invariant).        |

See [chapter 03's anchor section](./03-cryptography.md) for the
Merkle structure behind the `*_anchors` and `*_note_commitment_tree`
families.

**Indexing (RPC and wallet-facing convenience, NOT consensus).**
These exist so the RPC layer and downstream wallets (Zaino,
lightwalletd) can answer queries in constant or log time instead of
scanning the entire transaction history. A node could in principle
rebuild every entry here from the protocol-critical families above;
in practice, the indexes are populated as blocks are finalized.

| Column family                          | What it stores                                                    |
| -------------------------------------- | ----------------------------------------------------------------- |
| `tx_loc_by_hash`                       | Tx hash -> location (the lookup behind `gettransaction`).         |
| `hash_by_tx_loc`                       | Reverse: location -> tx hash.                                     |
| `balance_by_transparent_addr`          | Per-address running balance and received total (merge operator).  |
| `tx_loc_by_transparent_addr_loc`       | Per-address list of transactions touching it.                     |
| `utxo_loc_by_transparent_addr_loc`     | Per-address list of UTXO locations (`getaddressutxos`).           |
| `tx_loc_by_spent_out_loc`              | Inverse of `utxo_by_out_loc`: which tx spent which output.        |
| `sapling_note_commitment_subtree`      | Sapling subtree roots (ZIP 307 / lightwalletd shard streaming).   |
| `orchard_note_commitment_subtree`      | Orchard subtree roots (ZIP 307 / lightwalletd shard streaming).   |

The `balance_by_transparent_addr` column is the only family that
uses a RocksDB merge operator (`fetch_add_balance_and_received`),
because parallel writers concurrently bump per-address counters.
The wiring is in the same `construct_column_families` function
linked above.

**Internal / runtime.** Not part of the on-disk format proper:

| Column family     | What it stores                                                 |
| ----------------- | -------------------------------------------------------------- |
| `secondary_state` | Cache directory of the read-only secondary RocksDB instance. |

#### What Is NOT in This Database

Three categories of data that often surprise newcomers:

- **Wallet keys, addresses, notes, and balances.** Zebra is a
  validator node and stores none of this. Wallets such as
  [Zaino](https://github.com/zingolabs/zaino) (lightwalletd
  successor), [Zallet](https://github.com/zcash/wallet), and
  third-party wallets keep their own databases and consume Zebra
  over RPC. See [chapter 18](./18-mempool-mining-and-wallet-ecosystem.md).
- **The mempool.** Unmined transactions live in `zebra-node-services`
  / `zebra-rpc` in-memory structures. They are intentionally not
  persisted: an unexpected restart drops the mempool, the network
  refills it.
- **Peer reputation, address book, gossip state.** Owned by
  `zebra-network`; persisted separately under the cache dir (see
  the network config) and decoupled from consensus state.

The boundary is enforced architecturally: only `zebra-state` opens
the `state/` database, and it exposes typed `Request` / `ReadRequest`
surfaces. A wallet feature that "just adds one column family" is
out of Zebra's scope and gets closed at review.

#### How to Inspect the Database

Three options, from least to most invasive.

1. **Read Zebra's own startup logs.** At debug level the disk_db
   wrapper emits column family sizes for every CF on the disk:

   ```bash
   RUST_LOG=zebra_state=debug zebrad start 2>&1 | grep "Column families and sizes"
   ```

   This is the fastest way to confirm the database opened, the
   format version matches, and roughly how much each family weighs.
   The relevant log site is in `disk_db.rs::new_internal`.

2. **Open the database read-only from a second Zebra process.**
   `DiskDb::new` supports a `read_only` mode that opens the DB as a
   RocksDB **secondary instance** (`open_cf_descriptors_as_secondary`).
   The primary keeps writing; the secondary reads a consistent
   snapshot. The state RPC server (`scan` and `read` services) uses
   this mechanism. The `secondary_state` directory under the cache
   dir is the secondary instance's scratch space:

   ```rust reference title="zebra-state/src/service/finalized_state/disk_db.rs (read-only secondary)"
   https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-state/src/service/finalized_state/disk_db.rs#L993-L1013
   ```

3. **Drop to `ldb`, the RocksDB shell.** `ldb` is the RocksDB CLI;
   on Debian and Ubuntu it ships in the `rocksdb-tools` package.
   It must be the same major version as the RocksDB Zebra is
   linked against (check `Cargo.lock` for the `rocksdb` crate).
   With Zebra stopped:

   ```bash
   # List column families.
   ldb --db=~/.cache/zebra/state/v27/mainnet/ list_column_families

   # Iterate one column family. Keys and values are raw bytes (the
   # `IntoDisk` / `FromDisk` encoding), so add --hex to make sense of
   # the output.
   ldb --db=~/.cache/zebra/state/v27/mainnet/ \
       --column_family=tip_chain_value_pool \
       scan --hex
   ```

   Decoding key and value bytes requires the matching
   `disk_format/` impl. Each impl lives next to the type it
   serializes, e.g. `disk_format/shielded.rs` for nullifiers and
   anchors, `disk_format/block.rs` for headers and locations.

A future utility binary under `zebra-utils/` (not present at the
pinned tag) could provide typed inspection without `ldb`. For now,
inspection is either "read the logs" or "open RocksDB directly".

#### Failure Modes

- **Forgetting to bump `DATABASE_FORMAT_VERSION`** after a breaking
  change in `disk_format/`. The on-disk bytes diverge from what the
  reader expects and a silent corruption ships in the next release.
  The constant is at `zebra-state/src/constants.rs`; the upgrade
  procedure is in `book/src/dev/state-db-upgrades.md`.
- **Treating an indexing column as consensus-critical.** If a
  consensus check starts reading from `tx_loc_by_hash` or any other
  indexing family, the chain is no longer reproducible from the
  block stream alone; a rebuild of the indexes would silently change
  consensus.
- **Treating a consensus-critical column as indexing.** Skipping
  the write on a fork or letting it fall behind the block writer
  breaks the state-transition function. The single-writer task in
  `service/write.rs` is what prevents this; do not introduce a
  second writer.
- **Wallet creep.** A PR that adds wallet-style columns
  (per-account balances, decrypted notes, key material) drags Zebra
  outside its scope. The right home is Zaino, Zallet, or
  `librustzcash`.

### Non-finalized State

`non_finalized_state/` stores forks as a tree of `Chain` objects.
Each `Chain` is a sequence of blocks plus the deltas they cause
(treestates, nullifier sets, UTXO set, history tree, value pools).
The crate documents the read/write split in
`zebra-state/src/lib.rs`: writes go through `Request`, reads through
`ReadRequest`. They are separate Tower services and only the read
service is cheap to clone.

### Contextual Verification

`service/check/` implements the contextual checks: nullifier
non-revealedness, anchor existence, UTXO presence, transparent
expiry, difficulty adjustment context, coinbase maturity, value pool
invariants (no pool may go negative). The relevant RFC is `book/
src/dev/rfcs/0006-contextual-difficulty.md`. Value pool rules are in
RFC 0012.

### Tip and Watchers

`chain_tip/` exposes `LatestChainTip`, `ChainTipChange`, and
`ChainTipSender`. These give other components a `Stream` of tip
updates without coupling them to the state service. The
`watch_receiver.rs` shim wraps a `tokio::sync::watch::Receiver` into
a Stream.

This is the right place to learn the Zebra pattern of "use `watch`
channels for shared async state, never `Mutex`". This is also called
out in `AGENTS.md`.

## The `MAX_BLOCK_REORG_HEIGHT` Constant

100 blocks. Anything more than 100 blocks below the tip is final.
Used by:

- the finalization writer task,
- the mempool to decide expiry,
- the JSON-RPC `getblockcount` / `getbestblockhash` clients,
- the checkpoint generator (a checkpoint must be at least
  `MAX_BLOCK_REORG_HEIGHT` below tip).

## The Await UTXO Pattern

When verifying a transaction, the verifier may need a UTXO that has
not yet been written to disk because its block is still being
verified or has not yet arrived. Rather than blocking, the verifier
sends an `AwaitUtxo` request that returns a future. The future
resolves when the UTXO is committed or when its parent block fails.
This is RFC 0001 ("Pipelinable Block Lookup"). It is the architectural
basis for parallel block verification.

Crucially, every `AwaitUtxo` (and every commit) must be wrapped in a
timeout, called out at the top of `zebra-state/src/lib.rs`:

> Await UTXO and block commit requests should be wrapped in a
> timeout, because:
>  - await UTXO requests wait for a block containing that UTXO, and
>  - contextual verification and state updates wait for all previous
>    blocks.
> Otherwise, verification of out-of-order and invalid blocks can
> hang indefinitely.

## Suggested Exercises

1. open the RFCs under `book/src/dev/rfcs/` and read them in order
   0001 to 0012. They are short and they are the canonical
   architecture document for the state and consensus crates.
2. trace a single block from "received over P2P" to "written to
   RocksDB". Which crate does what at each step? Which queues hold
   it?
3. open `zebra-state/src/service/finalized_state/disk_format/` and
   list every column family. For each, what is the key and what is
   the value?
4. given a 101-block reorg attempt, where exactly is it rejected?
5. find the place where `MAX_BLOCK_SIGOPS` is checked. Now find
   every place in `zebra-script` that would contribute to that
   total.

## Spec Pointers

- Zcash protocol spec sections 3 (consensus rules) and 7.7 (block subsidy and reward).
- ZIPs 200 to 226 cover the Sapling-to-NU5 consensus deltas.
- `zebra-state/src/constants.rs`: the canonical database-format version.

## Exercises

1. Find one consensus rule in `zebra-consensus` that has a corresponding spec citation and confirm the citation matches the relevant section.
2. Trace the path of a single block from `zebrad` to the finalized state. Name every Tower service it passes through.
3. Add a debug log in the non-finalized state showing the depth at which a fork resolves. Run a regtest sync and confirm the log fires.
