---
sidebar_position: 3
title: "Cryptography in Zebra"
description: "Hash functions, Pedersen and Sinsemilla commitments, BLS12-381, Jubjub, Pallas, Vesta, and the Halo 2 transition."
---

# Cryptography in Zebra

## Why This Chapter Exists

Zcash is, structurally, a Merkle-tree-over-pedersen-commitments + groth16 + halo2 system bolted on top of a transparent UTXO chain. If you do not understand which primitive is used where and why, you cannot read the verification code. The chapter is the minimum you need before chapter 04.

This is the file to spend the most time on. Zebra itself implements
almost no cryptography directly; instead, it imports primitives from
the ECC/ZF ecosystem and wires them together with consensus and
network code. Knowing which crate owns which primitive is essential.

## Who Owns What

The Zcash cryptographic stack splits roughly like this:

- `librustzcash` (monorepo): `sapling-crypto`, `orchard`,
  `zcash_proofs`, `zcash_primitives`, `zcash_protocol`,
  `zcash_history`, `zcash_keys`, `zcash_transparent`,
  `zcash_address`, `zcash_note_encryption`, `zip32`,
  `incrementalmerkletree`, `equihash`. These are the high-level
  primitives.
- ZF-maintained: `redjubjub`, `reddsa`, `ed25519-zebra`.
- ECC + community: `halo2_proofs`, `halo2_gadgets`, `pasta_curves`,
  `jubjub`, `bls12_381`, `bellman`, `group`, `ff`,
  `blake2b_simd`, `blake2s_simd`.
- C++ FFI: `libzcash_script` (Zcash script interpreter, ported to
  Rust crate but still wrapping zcashd's C++ code) and
  `zcash_script` (a Rust-side reimplementation used in parallel
  comparison mode).

Inside Zebra, those primitives appear in three places:

1. [`zebra-chain/src/primitives/`](https://github.com/ZcashFoundation/zebra/tree/v4.4.1/zebra-chain/src/primitives) for byte-level wrappers and
   serialization.
2. [`zebra-consensus/src/primitives/`](https://github.com/ZcashFoundation/zebra/tree/v4.4.1/zebra-consensus/src/primitives) for the verifier services
   (Tower services with batching).
3. [`zebra-script`](https://github.com/ZcashFoundation/zebra/tree/v4.4.1/zebra-script) for the FFI to `libzcash_script`.

## Hash Functions

The Zcash hash function zoo:

- `BLAKE2b-256`: txid for v5+, [ZIP-244](https://zips.z.cash/zip-0244) sighash, [ZIP-221](https://zips.z.cash/zip-0221) history
  tree, [ZIP-216](https://zips.z.cash/zip-0216) jubjub canonical encoding domain separation. Personal
  string is part of the input. Provided by `blake2b_simd`.
- `BLAKE2b-512`: pre-NU5 transaction binding signatures, some key
  derivations. Provided by `blake2b_simd`.
- `BLAKE2s-256`: Equihash personalization, some key derivations.
  Provided by `blake2s_simd`.
- `SHA-256 / SHA-256d`: Bitcoin compatibility paths. Transparent
  txid (Bitcoin-style for v1 to v4), block header hash, P2SH script
  hash. Provided by `sha2`.
- `RIPEMD-160`: P2PKH/P2SH address derivation. Provided by
  `ripemd`.
- `Pedersen hash`: Sapling note commitments and Sapling commitment
  tree. Provided by `sapling-crypto`.
- `Sinsemilla`: Orchard note commitments and Orchard commitment
  tree. Provided by `orchard` and wrapped at
  [`zebra-chain/src/orchard/sinsemilla.rs`](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-chain/src/orchard/sinsemilla.rs).
- `FF1 (AES-128 based)`: diversifier derivation for Sapling/Orchard.
  Provided by ECC crates.
- `MiMC, Poseidon`: not used in mainnet Zcash today; Halo2 circuits
  use a domain-specific gadget set. Read the `halo2_gadgets` crate.

Personal strings (8 ASCII bytes appended to BLAKE2 calls for domain
separation) are scattered through ECC crates. Many bugs in early ZIP
implementations came from a wrong personal string; if you are
implementing a new verifier, double-check the personal string against
the spec.

## Signature Schemes

- ECDSA over secp256k1: transparent transactions, exactly like
  Bitcoin. Used in [`zebra-script`](https://github.com/ZcashFoundation/zebra/tree/v4.4.1/zebra-script) via libzcash_script. The Rust
  side uses `secp256k1`.
- Ed25519: Sprout JoinSplit signatures. Provided by `ed25519-zebra`,
  a ZF-maintained crate with stricter signature malleability rules
  ([ZIP-215](https://zips.z.cash/zip-0215)). Verifier at
  [`zebra-consensus/src/primitives/ed25519/`](https://github.com/ZcashFoundation/zebra/tree/v4.4.1/zebra-consensus/src/primitives/ed25519).
- RedJubjub: Sapling spend authorization and binding signatures, a
  Schnorr scheme over Jubjub. Defined in [ZIP-200](https://zips.z.cash/zip-0200) / Sapling spec
  section 4.1.6. Provided by `redjubjub`. Verifier at
  [`zebra-consensus/src/primitives/redjubjub/`](https://github.com/ZcashFoundation/zebra/tree/v4.4.1/zebra-consensus/src/primitives/redjubjub).
- RedPallas: same construction over Pallas, used by Orchard. [ZIP-221](https://zips.z.cash/zip-0221)
  family. Provided by `reddsa`. Verifier at
  [`zebra-consensus/src/primitives/redpallas/`](https://github.com/ZcashFoundation/zebra/tree/v4.4.1/zebra-consensus/src/primitives/redpallas).

All four verifiers in [`zebra-consensus/src/primitives/`](https://github.com/ZcashFoundation/zebra/tree/v4.4.1/zebra-consensus/src/primitives) are Tower
services wrapped in batch-control middleware. They accept verify
requests, accumulate them into a batch, verify the batch, and on batch
failure fall back to per-signature verification using
[`tower-fallback`](https://github.com/ZcashFoundation/zebra/tree/v4.4.1/tower-fallback). This is the architecture worth studying first
because it shows up again for proof systems.

## Commitment and Randomness

- Pedersen commitment over Jubjub: Sapling note commitments and
  value commitments. Defined in `sapling-crypto`.
- Sinsemilla commitment over Pallas: Orchard note commitments and
  value commitments. Defined in `orchard`.
- value commitment binding signatures: the homomorphic sum of value
  commitments must match the value balance, signed by RedJubjub or
  RedPallas key derived from sum of commitment randomness. This is
  the "binding signature" you will see referenced in the spec.

## Anchors and Note Commitment Trees

The anchor is the load-bearing primitive for shielded transfers. A
shielded spend does not name which note it is spending; that would
deanonymize the sender. Instead, the spender proves in zero
knowledge that the spent note is one of the leaves under a given
Merkle root, and the verifier checks that the cited root,
the **anchor**, matches some earlier block's final treestate. The
anchor is therefore both a cryptographic object (a Merkle root
over note commitments) and a consensus object (the on-chain record
the verifier checks against).

### What an Anchor Is

Each shielded pool maintains an append-only Merkle tree of note
commitments. The anchor is its root.

| Pool    | Leaf hash                     | Tree depth | Root type             | Code                                                                  |
| ------- | ----------------------------- | ---------- | --------------------- | --------------------------------------------------------------------- |
| Sprout  | SHA-256 (truncated)           | 29         | `[u8; 32]`            | [`zebra-chain/src/sprout/tree.rs`](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-chain/src/sprout/tree.rs)                                      |
| Sapling | Pedersen hash on Jubjub       | 32         | `jubjub::Base` (`Fq`) | [`zebra-chain/src/sapling/tree.rs`](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-chain/src/sapling/tree.rs)                                     |
| Orchard | Sinsemilla hash on Pallas     | 32         | `pallas::Base`        | [`zebra-chain/src/orchard/tree.rs`](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-chain/src/orchard/tree.rs)                                     |

The Sapling and Orchard roots wrap a single field element of the
relevant curve's base field. The tree depths are fixed by the
protocol:

```rust reference title="zebra-chain/src/sapling/tree.rs (MERKLE_DEPTH)"
https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-chain/src/sapling/tree.rs#L40-L40
```

Empty subtrees are pre-computed once per depth (the "uncommitted"
values), so that an empty position has a defined hash without
appending a real leaf.

### How an Anchor Is Updated

For each block, the state crate appends every new note commitment
in transaction order, then computes the new root. The hot path
is `NoteCommitmentTree::append(cm)` followed by `tree.root()`:

```rust reference title="zebra-chain/src/sapling/tree.rs (append)"
https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-chain/src/sapling/tree.rs#L204-L218
```

```rust reference title="zebra-chain/src/sapling/tree.rs (root)"
https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-chain/src/sapling/tree.rs#L378-L403
```

A few invariants follow:

1. The tree is **append-only**. Once a commitment is appended,
   neither it nor any earlier commitment moves. Rolling back a fork
   shortens the tree from the right but does not rewrite leaves.
2. The root is **monotone in block height up to a reorg**: between
   any two heights on the same chain, the later root commits to a
   superset of the earlier leaves.
3. Recomputation is incremental. The implementation uses an
   `incrementalmerkletree::Frontier`, so each block costs $O(d)$
   hash invocations per added commitment (where $d$ is the depth),
   not $O(d \cdot n)$ for the whole tree.

### Where an Anchor Is Stored

Zebra stores anchors in two places, mirroring its
finalized/non-finalized state split.

**Finalized state (RocksDB column families).** Once a block has
enough confirmations, its anchors are written to dedicated column
families. Each pool has its own family:

```rust reference title="zebra-state/src/service/finalized_state/zebra_db/shielded.rs (contains_*_anchor)"
https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-state/src/service/finalized_state/zebra_db/shielded.rs#L100-L117
```

The column families are named `sprout_anchors`, `sapling_anchors`,
and `orchard_anchors`. For Sprout, the value stored at each anchor
is the matching note commitment tree (because Sprout spends do not
share an anchor across joinsplits, and the prover must reconstruct
auth paths from the tree). For Sapling and Orchard the value is
unit `()`; only the existence of the anchor matters.

**Non-finalized state (in-memory fork forest).** Each candidate
chain carries its own anchor sets. They are stored both as a
`MultiSet<Root>` (for fast membership tests during verification)
and as a `BTreeMap<Height, Root>` (so the chain can be unwound on a
reorg):

```rust reference title="zebra-state/src/service/non_finalized_state/chain.rs (anchor fields)"
https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-state/src/service/non_finalized_state/chain.rs#L155-L191
```

The `MultiSet` matters: two distinct blocks can have the same final
anchor (when no shielded notes were added between them, the tree is
unchanged), so the membership count must be decremented exactly
on rollback.

### Anchors in Transactions

The encoding of the anchor on the wire differs by transaction
version, because shared anchors save bytes when a transaction has
multiple spends from the same pool.

- **Sprout (joinsplits)**: each `JoinSplit` carries its own
  `anchor` field.
- **Sapling V4 transactions**: each `Spend` description carries
  `per_spend_anchor`.
- **Sapling V5 transactions (post-NU5)**: a single
  `shared_anchor` is encoded at the bundle level and reused by
  every Spend.
- **Orchard (V5 only)**: a single `shared_anchor` per Orchard
  action bundle.

The two cases are encoded in the `AnchorVariant` trait so that the
`Spend` struct can be reused for both shapes:

```rust reference title="zebra-chain/src/sapling/shielded_data.rs (AnchorVariant trait and impls)"
https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-chain/src/sapling/shielded_data.rs#L45-L67
```

### The Consensus Rule

A spending transaction does not invent its anchor; it cites one.
The consensus rule is that the cited anchor must equal the final
treestate of *some earlier block on the same chain*. The check
lives in the state crate:

```rust reference title="zebra-state/src/service/check/anchors.rs (sapling_orchard_anchors_refer_to_final_treestates)"
https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-state/src/service/check/anchors.rs#L20-L78
```

The verifier looks up the anchor in the non-finalized chain's
`MultiSet`, falls back to the finalized state, and rejects the
transaction if neither contains it. The check is per-pool: a
Sapling anchor must match a Sapling treestate, an Orchard anchor
must match an Orchard treestate. Mempool transactions are checked
against the best-tip treestate; block transactions are checked
against the treestate at the height of the *parent* block.

There is a subtle floor: the anchor must refer to the **final**
treestate of an earlier block, not an intermediate state inside the
current block. This prevents a transaction from spending a note
that was created by another transaction in the same block. Tests
for the rule live in [`zebra-state/src/service/check/tests/anchors.rs`](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-state/src/service/check/tests/anchors.rs).

### Failure Modes

- **Computing a different root.** A bug in the incremental Merkle
  frontier, in the empty-subtree precomputation, or in field
  serialization will give a root that disagrees with `zcashd` or
  `librustzcash`. The regression surfaces as a refused transaction
  on mainnet that other nodes accept. Caught by the test vectors
  in [`zebra-chain/src/sapling/tests/`](https://github.com/ZcashFoundation/zebra/tree/v4.4.1/zebra-chain/src/sapling/tests) and the integration tests
  that sync against checkpoints.
- **Allowing a non-final anchor.** If the consensus check accepts
  an anchor that is the *intermediate* treestate after some but
  not all of the current block's commitments, a transaction can
  spend a note created earlier in the same block, breaking the
  intended ordering. Caught by tests under
  [`zebra-state/src/service/check/tests/anchors.rs`](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-state/src/service/check/tests/anchors.rs).
- **MultiSet underflow on reorg.** Because identical anchors can
  repeat across heights, the non-finalized state stores anchors
  as a `MultiSet`. Decrementing past zero on a rollback is a logic
  bug that silently corrupts membership; the type's invariant is
  load-bearing.
- **Cross-pool anchor reuse.** A Sapling anchor and an Orchard
  anchor are both single field elements, but in different fields
  (Jubjub `Fq` vs Pallas `Base`). The type system separates them,
  but a manual `bytemuck` or `transmute` would defeat it. Do not
  add such conversions.

See [chapter 04](./04-consensus-and-state.md) for how the anchor
sits within the broader state machine, including how the tree is
checkpointed in the finalized database and how the non-finalized
state recomputes anchors on a reorg.

## Key Derivation

- BIP-32 for transparent keys.
- [ZIP-32](https://zips.z.cash/zip-0032) for shielded keys (Sapling and Orchard), provided by the
  `zip32` crate.
- diversifier derivation uses FF1.
- viewing key hierarchy: spending key gives spend authority and
  viewing capability; full viewing key gives view-only capability;
  incoming viewing key gives only the ability to scan for incoming
  notes.

## Note Encryption

[ZIP-216](https://zips.z.cash/zip-0216) / spec section 4.7. Implemented in `zcash_note_encryption`,
re-exported through [`zebra-chain/src/primitives/zcash_note_encryption.rs`](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-chain/src/primitives/zcash_note_encryption.rs).

Sapling and Orchard note encryption use the same generic framework
with different KDF inputs and curve parameters. Both use
ChaCha20-Poly1305 as AEAD.

For your work as principal cryptography engineer, the things to look
at carefully:

- AEAD nonce derivation (must be unique per ephemeral key).
- KDF input ordering (spec is exact about byte order; a transposition
  here is fatal).
- the "out-viewing-key" branch that lets the sender recover their own
  outgoing notes.

## Zero-knowledge Proofs

Two systems in use:

1. Groth16 over BLS12-381 (Sapling): pre-NU5 spend and output
   proofs, and the Sprout JoinSplit proof (BCTV14 originally, swapped
   to Groth16 in Sapling-on-BCTV14 vs Sapling-on-Groth16 era; modern
   Sprout proofs are Groth16). Verifier at
   [`zebra-consensus/src/primitives/groth16/`](https://github.com/ZcashFoundation/zebra/tree/v4.4.1/zebra-consensus/src/primitives/groth16). Proving keys come from
   the Sapling and Sprout MPC ceremonies; verifying keys are
   compiled-in constants. Provided by `bellman` (proving) and
   `bls12_381` (curve).
2. Halo2 (Orchard): NU5+ Orchard Action proofs. Verifier at
   [`zebra-consensus/src/primitives/halo2.rs`](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-consensus/src/primitives/halo2.rs). Provided by
   `halo2_proofs` (the implementation Zebra depends on is the
   `zcash-halo2` fork pinned at workspace version `0.3` via
   `halo2 = "0.3"`).

[`zebra-consensus/src/primitives/sapling.rs`](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-consensus/src/primitives/sapling.rs) is the place where
Sapling-specific verifying logic is glued. The Groth16 module
delegates batched verification to `bellman` and adds Tower
batching on top so a whole block's spend and output proofs can be
verified in one multi-exp.

Things to study in this area:

- the batched Groth16 trick: a random linear combination of n
  verification equations reduces to one pairing check, valid with
  overwhelming probability if the prover does not adapt to the
  randomness. See the `bellman` BatchVerifier.
- Halo2 batching is structurally different; the verifier runs full
  IPA opening checks but the multiscalar multiplications can be
  combined across instances.
- the "batch then fall back" pattern, implemented with
  [`tower-batch-control`](https://github.com/ZcashFoundation/zebra/tree/v4.4.1/tower-batch-control) + [`tower-fallback`](https://github.com/ZcashFoundation/zebra/tree/v4.4.1/tower-fallback). When the batch fails,
  the offending item is identified by re-verifying each item in the
  batch.

## Script Verification

[`zebra-script`](https://github.com/ZcashFoundation/zebra/tree/v4.4.1/zebra-script) is the FFI boundary. The Rust API is
`CachedFfiTransaction` which:

- holds a `zebra_chain::Transaction` and the `transparent::Output`s
  it spends,
- precomputes the `SigHasher` (the [ZIP-244](https://zips.z.cash/zip-0244) sighash for v5+ or the
  v4 sighash for older transactions),
- exposes `is_valid(input_index)` which calls the C++ interpreter
  via `libzcash_script` to verify the script.

Read [`zebra-script/src/lib.rs`](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-script/src/lib.rs) carefully. Two cryptographic details
appear inline there:

1. v5+ transaction hash type validation. Valid hash types are
   `{0x01, 0x02, 0x03, 0x81, 0x82, 0x83}`. Anything else is rejected
   immediately, matching zcashd's `SighashType::parse`.
2. v5+ `SIGHASH_SINGLE` without a corresponding output is rejected
   ([ZIP-244](https://zips.z.cash/zip-0244) section S.2a). This is the exact mismatch fixed by
   release v4.4.1 in the recent commit history at `1ec1078e2`.

The function also documents a workaround for a libzcash_script
callback bug: the C++ interpreter does not propagate callback failure
back through the verifier, so on a "should not verify" case the Rust
side returns a random 32-byte sighash instead of a fixed sentinel.
This is the kind of detail that defines principal-level work on this
codebase. Read this section twice.

There is also a parallel-Rust implementation behind the
`comparison-interpreter` feature flag, which runs both interpreters
side by side and compares results. Look at `get_interpreter` to see
the toggle.

## The `Sigops` Trait

[`zebra-script/src/lib.rs`](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-script/src/lib.rs) defines `Sigops` (legacy sigop count) and
the free function `p2sh_sigop_count` (P2SH sigop count). Both must
match zcashd's exact behavior, including the coinbase scriptSig
contribution and the "non-push-only redeem script returns 0 sigops"
quirk. The doc comments link to the exact lines in
`zcash/zcash/src/main.cpp` for parity. This is a good pattern: every
consensus-critical port should link the reference C++ source.

## Equihash (Proof of Work)

Zcash uses Equihash(200, 9) with `ZcashPoW` personalization. The
solution is 1344 bytes. The verifier is in the `equihash` crate;
Zebra wraps it at [`zebra-chain/src/work/equihash.rs`](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-chain/src/work/equihash.rs). There is no
Zebra-side implementation of the algorithm; we just verify.

## groth16 Trusted Setup Parameters

zk-SNARK verifying keys are needed at runtime. For Sapling and Sprout
they are constants compiled in via `zcash_proofs`. There are
parameter files that historical zcashd versions downloaded; modern
Zebra and zcashd embed them. See the user-facing doc
[`book/src/user/parameters.md`](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/book/src/user/parameters.md) for the user-facing story.

## What to Read Alongside

- the Zcash Protocol Specification (NU6 version), sections 3
  (concepts), 4 (abstract protocol), 5 (concrete protocol), 7
  (consensus changes).
- the Sapling paper (Hopwood, Bowe, Hornby, Wilcox-O'Hearn, 2016).
- the Orchard book and the halo2 book.
- [ZIP-32](https://zips.z.cash/zip-0032) (HD wallets for shielded), [ZIP-200](https://zips.z.cash/zip-0200) (Sapling), [ZIP-216](https://zips.z.cash/zip-0216)
  (jubjub canonical encoding), [ZIP-221](https://zips.z.cash/zip-0221) (history tree), [ZIP-243](https://zips.z.cash/zip-0243)
  (Sapling sighash), [ZIP-244](https://zips.z.cash/zip-0244) (NU5 txid and sighash).

## Suggested Exercises

1. trace a v5 transaction from the wire to the point where a Halo2
   proof is verified. List every crate it touches.
2. open [`zebra-consensus/src/primitives/groth16/`](https://github.com/ZcashFoundation/zebra/tree/v4.4.1/zebra-consensus/src/primitives/groth16) and answer: what
   is a "batch", how is it formed, and what happens when it fails?
3. read [`zebra-script/src/lib.rs`](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-script/src/lib.rs) end to end. Identify every place
   where a sighash decision would differ between v4 and v5+.
4. find every call site of `blake2b_simd::Params::new()` across the
   workspace and list the personal strings used. (Hint: `grep -rn
   "personal" $WORKSPACE`.)

## Spec Pointers

- Zcash protocol spec sections 5 (cryptographic building blocks) and 4.1 (commitments).
- [BLS12-381 standard](https://datatracker.ietf.org/doc/draft-irtf-cfrg-pairing-friendly-curves/).
- [Halo 2 book](https://zcash.github.io/halo2/) for the Orchard proving system.

## Exercises

1. Find a Pedersen commitment call site in [`zebra-chain`](https://github.com/ZcashFoundation/zebra/tree/v4.4.1/zebra-chain) and list the inputs (the message and the randomness). Where does the randomness come from?
2. The `equihash` proof-of-work uses parameters `(n, k) = (200, 9)` on mainnet. Find where they are encoded and confirm the chosen path length matches the spec.
3. Identify one Sinsemilla call site in Orchard code and explain in one sentence what is being committed to.
