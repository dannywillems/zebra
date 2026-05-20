# 04. consensus and state

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

### the router

`router/` chooses between two verification paths depending on whether
the block height is below the latest checkpoint or above it.

- below the checkpoint: only structural validity plus checkpoint
  hash match is required. Everything else is implied by the
  checkpoint. This is what makes initial block download fast.
- above the checkpoint: full semantic verification (signatures,
  proofs, scripts, sigop counts, value balance, etc.).

Read `router/service_trait.rs` to see how the router exposes itself
as a single Tower service.

### checkpoint verification

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

### block verification (full path)

`block/check.rs` implements the per-block semantic checks: header
checks, time bounds, difficulty target, coinbase rules, subsidy,
sigop limit, version checks, transparent input/output well-formedness,
etc. `block/subsidy/` computes the per-height block subsidy and the
funding-stream payouts (FRs since Canopy, then NSM since NU6).

`MAX_BLOCK_SIGOPS` is exported. The "what counts as a sigop" rule
matches zcashd's `GetLegacySigOpCount + GetP2SHSigOpCount`. The
matching code is in `zebra-script/src/lib.rs` (see `Sigops` trait
and `p2sh_sigop_count`).

### transaction verification

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

### primitives (verifier services)

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

### script

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

### finalized vs non-finalized

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

### non-finalized state

`non_finalized_state/` stores forks as a tree of `Chain` objects.
Each `Chain` is a sequence of blocks plus the deltas they cause
(treestates, nullifier sets, UTXO set, history tree, value pools).
The crate documents the read/write split in
`zebra-state/src/lib.rs`: writes go through `Request`, reads through
`ReadRequest`. They are separate Tower services and only the read
service is cheap to clone.

### contextual verification

`service/check/` implements the contextual checks: nullifier
non-revealedness, anchor existence, UTXO presence, transparent
expiry, difficulty adjustment context, coinbase maturity, value pool
invariants (no pool may go negative). The relevant RFC is `book/
src/dev/rfcs/0006-contextual-difficulty.md`. Value pool rules are in
RFC 0012.

### tip and watchers

`chain_tip/` exposes `LatestChainTip`, `ChainTipChange`, and
`ChainTipSender`. These give other components a `Stream` of tip
updates without coupling them to the state service. The
`watch_receiver.rs` shim wraps a `tokio::sync::watch::Receiver` into
a Stream.

This is the right place to learn the Zebra pattern of "use `watch`
channels for shared async state, never `Mutex`". This is also called
out in `AGENTS.md`.

## the `MAX_BLOCK_REORG_HEIGHT` constant

100 blocks. Anything more than 100 blocks below the tip is final.
Used by:

- the finalization writer task,
- the mempool to decide expiry,
- the JSON-RPC `getblockcount` / `getbestblockhash` clients,
- the checkpoint generator (a checkpoint must be at least
  `MAX_BLOCK_REORG_HEIGHT` below tip).

## the await UTXO pattern

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

## suggested exercises

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
