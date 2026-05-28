---
sidebar_position: 2
title: "zebra-chain: The Data Model"
description: "Blocks, transactions, sapling and orchard bundles, transparent UTXOs, addresses, and serialization."
---

# zebra-chain: The Data Model

## Why This Chapter Exists

Every other crate depends on `zebra-chain`. If a type here is wrong, every downstream invariant is suspect. The chapter is also the friendliest entry point because it is purely synchronous: no Tokio, no Tower, no I/O. By the end you should be able to read a raw transaction byte string and tell which version, which Sapling/Orchard bundles, and which transparent inputs and outputs it contains.

`zebra-chain` is the sync-only crate that defines every consensus-
critical data type Zebra manipulates. No async, no Tokio, no Tower.
Everything here is either:

- a Zcash data structure (block, transaction, address, note, key,
  commitment, tree, etc.),
- a serialization concern (the Zcash-flavored Bitcoin format),
- a parameter table (network, upgrade, subsidy, checkpoint), or
- a numeric type with consensus-relevant invariants (amount, height,
  value balance, work, difficulty).

Start with `zebra-chain/src/lib.rs` for the module map. The crate is
declared with `recursion_limit = "256"` because of bitvec macros.

## Module Tour

Each item below maps to a directory under `zebra-chain/src/`.

### Serialization

`serialization/` defines the Zcash binary wire format. Zcash inherits
Bitcoin's `CompactSize` varints, little-endian fixed-width integers,
length-prefixed vectors, and SHA-256d hashes. Read this module
first; almost every type implements `ZcashSerialize`/
`ZcashDeserialize` from here.

Important: any deserialization that consumes attacker-controlled bytes
must use `TrustedPreallocate` (also defined in this module) to bound
allocation size. This is a security invariant called out in
`AGENTS.md`.

### Parameters

`parameters/` defines `Network` (Mainnet, Testnet variants), the
`NetworkUpgrade` enum (`Genesis`, `BeforeOverwinter`, `Overwinter`,
`Sapling`, `Blossom`, `Heartwood`, `Canopy`, `Nu5`, `Nu6`, `Nu6_1`,
`Nu7`, plus a gated `ZFuture`), activation height tables for mainnet
and testnet, consensus branch ids, subsidy parameters, checkpoint
data, and the Testnet configuration parameters used by Regtest.

`network_upgrade.rs` is the source of truth for the chain of network
upgrades. Variants must be ordered by activation height; the trait
implementations rely on `Ord`.

The `testnet.rs` submodule lets you build a custom testnet
configuration (used for Regtest and private testnets), so it is the
right place to learn what parameters are actually tunable per
network.

### Block

`block/` defines `Block`, `Header`, `Hash`, `Height`, the Merkle root
helper, the genesis hash table, and block commitment. The
`Commitment` type encodes which block header commitment scheme is in
use for a given height (pre-Sapling has none, then Sapling tree root,
then chain history root, then a hash of treestate-and-history per
NU5).

The `serialize.rs` here is critical: it defines the block header on-
disk and on-wire layout, including the 1344-byte Equihash solution.

### Transaction

`transaction/` defines the union type `Transaction` with variants for
versions 1, 2 (Sprout), 3 (Overwinter), 4 (Sapling), and 5 (NU5+).
v6/NU7 lives behind the `nu7` cfg flag. Each variant carries its own
mix of transparent inputs/outputs, Sprout JoinSplits, Sapling Spends
and Outputs, and Orchard Actions.

Read in this order:

1. `transaction.rs` for the type itself.
2. `serialize.rs` for the on-wire format. v5 uses a different layout
   from v4, including the per-pool separation of authorization and
   non-authorizing data.
3. `txid.rs` and `auth_digest.rs` for ZIP-244 transaction id and
   authorizing data digest computation (NU5+).
4. `sighash.rs` for the signature hash computation. v4 uses a v4
   sighash; v5 uses the ZIP-244 sighash, which is also exposed for
   transparent signers via the `SigHasher` type.
5. `hash.rs` for the bound `Hash` type and Display order conventions.
6. `lock_time.rs`, `memo.rs`, `joinsplit.rs`, `builder.rs`,
   `unmined/` for the rest.

### Transparent

`transparent/` defines the Bitcoin-style transparent pool: P2PKH and
P2SH addresses (`address.rs`), the script bytes wrapper
(`script.rs`), opcodes (`opcodes.rs`), and the UTXO type
(`utxo.rs`). Actual script *execution* is delegated to `zebra-
script` (FFI to libzcash_script). This module only models the bytes
and addresses.

### Sprout, Sapling, Orchard

Each pool gets its own module with the same shape:

- `keys.rs`: spending key, viewing key, payment address types.
- `note.rs`: the note type (value + recipient + randomness).
- `commitment.rs`: note commitment (Pedersen for Sprout/Sapling,
  Sinsemilla for Orchard).
- `tree.rs`: the commitment tree (Sprout uses incremental SHA-256;
  Sapling uses incremental Pedersen; Orchard uses incremental
  Sinsemilla). Wraps `incrementalmerkletree`.
- pool-specific transfer types: `joinsplit.rs` for Sprout,
  `spend.rs`/`output.rs` for Sapling, `action.rs` for Orchard.
- `shielded_data.rs`: the per-tx pool bundle as it appears in a
  Sapling v4 or v5 transaction, or an Orchard v5 transaction.

`sinsemilla.rs` under `orchard/` exposes the Sinsemilla hash. It is
the only Sinsemilla call site inside `zebra-chain`; everything else
calls into the `orchard` crate (ECC).

The internals of the proofs themselves (Groth16 for Sapling, Halo2 for
Orchard) are not built here; only the witness types and verifying
inputs are.

### Primitives

`primitives/` is the cross-pool primitives module. It contains:

- `address.rs`: unified types and routing.
- `byte_array.rs`: helpers.
- `proofs/`: opaque proof byte types (Groth16, Halo2). The verifier
  for these lives in `zebra-consensus/src/primitives/`.
- `zcash_history/`: chain history tree (ZIP-221).
- `zcash_note_encryption.rs`: note encryption wrapper around the
  `zcash_note_encryption` crate.
- `zcash_primitives.rs`: conversions to/from the `zcash_primitives`
  representation, used wherever Zebra hands a transaction to ECC code
  (for example to compute a sighash via ZIP-244 in `librustzcash`).

### Work and Difficulty

`work/` defines:

- `difficulty/`: the compact `nBits` representation, the `Work`
  scalar, and `ExpandedDifficulty`. The crate-level constants for
  PoWMedianBlockSpan and friends are here too.
- `equihash.rs`: a thin wrapper around the `equihash` crate, with
  Zcash's `(n=200, k=9)` parameters. Solution length is 1344 bytes.
- `u256.rs`: a 256-bit unsigned big-endian integer used in work
  comparisons.

### History_tree

`history_tree/` is the chain history MMR introduced in Heartwood
(ZIP-221). Each block commits to the root of this tree, so the
history tree is computed and stored as part of the state.

### Value_balance, Amount

`amount.rs` and `value_balance.rs` enforce that values are within
constructed bounds. `Amount<C>` is parameterized by a
`Constraint` type so that pool inputs are typed differently from
pool outputs (`NonNegative` vs `NegativeAllowed`). Addition and
subtraction return `Result` so overflow is propagated explicitly.

This is one of the most important examples of "use the type system
to encode consensus invariants" in Zebra. Read `amount.rs` and the
corresponding tests carefully.

### Chain_tip and Chain_sync_status

`chain_tip.rs` defines the `ChainTip` trait that lets components
above the state crate observe the latest tip without coupling to it.
Various tip observers (latest tip block, tip change watcher) are
implemented here.

`chain_sync_status.rs` exposes a separate trait for sync status
(close-to-tip vs far-from-tip). Used by the inbound and mempool
services to decide whether to participate in gossip.

## Things to Internalize From zebra-chain

- the type-system encoding of consensus invariants (Amount,
  ValueBalance, Height, Hash with byte-order display, Constraint
  newtypes).
- the wire format vs display order convention. Hashes, txids, and
  block hashes are stored in internal byte order, displayed in
  reverse. Bugs hide in this gap.
- the per-network-upgrade variant pattern in `NetworkUpgrade` and
  `Transaction`.
- the proptest infrastructure: every consensus-relevant type
  implements `Arbitrary` (gated on `proptest-impl`). This is what
  makes property tests across other crates possible.

## Suggested Exercises

1. find the activation height of every network upgrade on mainnet and
   on the default testnet without reading the comments. Hint: the
   tables are in `parameters/constants.rs`.
2. given a serialized block hex string, sketch how you would parse it
   into a `Block`. What module decides which `Transaction` variant
   to construct?
3. find the place that wraps Sinsemilla and the place that wraps
   Pedersen. Why does one live in `orchard/` and the other in
   `sapling/`?
4. open `transaction/sighash.rs` and trace the v5 sighash
   computation back into `zcash_primitives`. Where exactly does
   Zebra hand control to ECC code?

## Spec Pointers

- Zcash protocol spec sections 7.1 (transaction format) and 7.6 (block format).
- ZIP 225 (transaction format v5).
- BIP 144 (witness serialization), referenced by Zcash transparent inputs.

## Exercises

1. Find the `ZcashSerialize` impl for `Transaction` and trace which fields are written for each version. Cite the file and line.
2. Build a v5 transaction with one Sapling spend and one Orchard action and serialize it round-trip. Where do the bundle digests live?
3. Add a property test that round-trips a randomly generated `transparent::Input` and confirms equality. Run it with `cargo test -p zebra-chain`.
