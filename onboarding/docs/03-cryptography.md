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

1. `zebra-chain/src/primitives/` for byte-level wrappers and
   serialization.
2. `zebra-consensus/src/primitives/` for the verifier services
   (Tower services with batching).
3. `zebra-script` for the FFI to `libzcash_script`.

## Hash Functions

The Zcash hash function zoo:

- `BLAKE2b-256`: txid for v5+, ZIP-244 sighash, ZIP-221 history
  tree, ZIP-216 jubjub canonical encoding domain separation. Personal
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
  `zebra-chain/src/orchard/sinsemilla.rs`.
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
  Bitcoin. Used in `zebra-script` via libzcash_script. The Rust
  side uses `secp256k1`.
- Ed25519: Sprout JoinSplit signatures. Provided by `ed25519-zebra`,
  a ZF-maintained crate with stricter signature malleability rules
  (ZIP-215). Verifier at
  `zebra-consensus/src/primitives/ed25519/`.
- RedJubjub: Sapling spend authorization and binding signatures, a
  Schnorr scheme over Jubjub. Defined in ZIP-200 / Sapling spec
  section 4.1.6. Provided by `redjubjub`. Verifier at
  `zebra-consensus/src/primitives/redjubjub/`.
- RedPallas: same construction over Pallas, used by Orchard. ZIP-221
  family. Provided by `reddsa`. Verifier at
  `zebra-consensus/src/primitives/redpallas/`.

All four verifiers in `zebra-consensus/src/primitives/` are Tower
services wrapped in batch-control middleware. They accept verify
requests, accumulate them into a batch, verify the batch, and on batch
failure fall back to per-signature verification using
`tower-fallback`. This is the architecture worth studying first
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

## Key Derivation

- BIP-32 for transparent keys.
- ZIP-32 for shielded keys (Sapling and Orchard), provided by the
  `zip32` crate.
- diversifier derivation uses FF1.
- viewing key hierarchy: spending key gives spend authority and
  viewing capability; full viewing key gives view-only capability;
  incoming viewing key gives only the ability to scan for incoming
  notes.

## Note Encryption

ZIP-216 / spec section 4.7. Implemented in `zcash_note_encryption`,
re-exported through `zebra-chain/src/primitives/zcash_note_encryption.rs`.

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
   `zebra-consensus/src/primitives/groth16/`. Proving keys come from
   the Sapling and Sprout MPC ceremonies; verifying keys are
   compiled-in constants. Provided by `bellman` (proving) and
   `bls12_381` (curve).
2. Halo2 (Orchard): NU5+ Orchard Action proofs. Verifier at
   `zebra-consensus/src/primitives/halo2.rs`. Provided by
   `halo2_proofs` (the implementation Zebra depends on is the
   `zcash-halo2` fork pinned at workspace version `0.3` via
   `halo2 = "0.3"`).

`zebra-consensus/src/primitives/sapling.rs` is the place where
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
  `tower-batch-control` + `tower-fallback`. When the batch fails,
  the offending item is identified by re-verifying each item in the
  batch.

## Script Verification

`zebra-script` is the FFI boundary. The Rust API is
`CachedFfiTransaction` which:

- holds a `zebra_chain::Transaction` and the `transparent::Output`s
  it spends,
- precomputes the `SigHasher` (the ZIP-244 sighash for v5+ or the
  v4 sighash for older transactions),
- exposes `is_valid(input_index)` which calls the C++ interpreter
  via `libzcash_script` to verify the script.

Read `zebra-script/src/lib.rs` carefully. Two cryptographic details
appear inline there:

1. v5+ transaction hash type validation. Valid hash types are
   `{0x01, 0x02, 0x03, 0x81, 0x82, 0x83}`. Anything else is rejected
   immediately, matching zcashd's `SighashType::parse`.
2. v5+ `SIGHASH_SINGLE` without a corresponding output is rejected
   (ZIP-244 section S.2a). This is the exact mismatch fixed by
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

`zebra-script/src/lib.rs` defines `Sigops` (legacy sigop count) and
the free function `p2sh_sigop_count` (P2SH sigop count). Both must
match zcashd's exact behavior, including the coinbase scriptSig
contribution and the "non-push-only redeem script returns 0 sigops"
quirk. The doc comments link to the exact lines in
`zcash/zcash/src/main.cpp` for parity. This is a good pattern: every
consensus-critical port should link the reference C++ source.

## Equihash (Proof of Work)

Zcash uses Equihash(200, 9) with `ZcashPoW` personalization. The
solution is 1344 bytes. The verifier is in the `equihash` crate;
Zebra wraps it at `zebra-chain/src/work/equihash.rs`. There is no
Zebra-side implementation of the algorithm; we just verify.

## groth16 Trusted Setup Parameters

zk-SNARK verifying keys are needed at runtime. For Sapling and Sprout
they are constants compiled in via `zcash_proofs`. There are
parameter files that historical zcashd versions downloaded; modern
Zebra and zcashd embed them. See the user-facing doc
`book/src/user/parameters.md` for the user-facing story.

## What to Read Alongside

- the Zcash Protocol Specification (NU6 version), sections 3
  (concepts), 4 (abstract protocol), 5 (concrete protocol), 7
  (consensus changes).
- the Sapling paper (Hopwood, Bowe, Hornby, Wilcox-O'Hearn, 2016).
- the Orchard book and the halo2 book.
- ZIP-32 (HD wallets for shielded), ZIP-200 (Sapling), ZIP-216
  (jubjub canonical encoding), ZIP-221 (history tree), ZIP-243
  (Sapling sighash), ZIP-244 (NU5 txid and sighash).

## Suggested Exercises

1. trace a v5 transaction from the wire to the point where a Halo2
   proof is verified. List every crate it touches.
2. open `zebra-consensus/src/primitives/groth16/` and answer: what
   is a "batch", how is it formed, and what happens when it fails?
3. read `zebra-script/src/lib.rs` end to end. Identify every place
   where a sighash decision would differ between v4 and v5+.
4. find every call site of `blake2b_simd::Params::new()` across the
   workspace and list the personal strings used. (Hint: `grep -rn
   "personal" $WORKSPACE`.)

## Spec Pointers

- Zcash protocol spec sections 5 (cryptographic building blocks) and 4.1 (commitments).
- [BLS12-381 standard](https://datatracker.ietf.org/doc/draft-irtf-cfrg-pairing-friendly-curves/).
- [Halo 2 book](https://zcash.github.io/halo2/) for the Orchard proving system.

## Exercises

1. Find a Pedersen commitment call site in `zebra-chain` and list the inputs (the message and the randomness). Where does the randomness come from?
2. The `equihash` proof-of-work uses parameters `(n, k) = (200, 9)` on mainnet. Find where they are encoded and confirm the chosen path length matches the spec.
3. Identify one Sinsemilla call site in Orchard code and explain in one sentence what is being committed to.
