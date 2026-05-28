---
sidebar_position: 11
title: "Cryptographic Correctness Practices"
description: "Constant-time discipline, test vectors, batch verification, and what the audit checklist actually checks."
---

# Cryptographic Correctness Practices

## Why This Chapter Exists

Zebra is not a crypto library, but it consumes them and gets the parts where it composes them wrong at its peril. This chapter is the checklist: constant-time discipline, batch verification, test vectors, malleability.

The engineering discipline that turns mathematically correct
cryptography into operationally correct cryptography. This file is
the checklist you should mentally run through every time you review
or write code that touches crypto.

## Constant-time Discipline

A constant-time operation runs in time independent of secret inputs.
The threat is a remote attacker measuring response time to recover
key bits.

Which crates promise constant time:

- `secp256k1`: yes, derived from libsecp256k1.
- `ed25519-zebra` / `ed25519-dalek`: scalar ops constant time;
  signature verification path uses variable-time multiscalar (this
  is fine because verification inputs are public).
- `jubjub`, `pasta_curves`, `bls12_381`: scalar field ops aim for
  constant time; documentation lists exceptions explicitly.
- `bellman`, `halo2_proofs`: verification is variable-time; proving
  needs care if proving keys are secret (they are in normal Zcash
  use).
- `sha2`, `blake2b_simd`, `blake2s_simd`: constant time on
  reasonable inputs (no secret-length truncation).

In Zebra specifically, the node holds no secret keys. There is no
real timing-attack surface from the node side. The discipline
matters when reviewing libraries Zebra depends on, and when
reviewing wallet code that does depend on Zebra crates indirectly.

Review checklist:

- does this code branch on secret data?
- does this code index into a table by secret bits?
- does this code use `==` on byte arrays containing secrets? (Use
  `subtle::ConstantTimeEq` instead.)

## Canonical Encoding

[ZIP-216](https://zips.z.cash/zip-0216) generalized: every consensus-critical encoding must have
exactly one valid byte representation. Two encodings that decode to
the same value but differ in bytes are a malleability surface and
potentially a consensus-split surface.

What to check when wrapping a new primitive:

- does the underlying library enforce canonicity on decode, or does
  it accept multiple equivalent encodings?
- can field elements be encoded with the high bit unset? (Most curve
  libraries do; some do not. Verify per type.)
- can group elements be encoded with the sign bit ambiguous? (Yes
  for most short-Weierstrass and Edwards curves with compressed
  encoding.)
- can a varint or `CompactSize` be encoded with more bytes than
  necessary? Bitcoin and Zcash require minimal encoding.

Review checklist:

- decode then re-encode and compare bytes. The decode-encode-decode
  round-trip must be a fixed point.
- proptest: for any byte string, if it parses, it must round-trip
  back to itself.

## Signature and Proof Malleability

Malleability is the ability to mutate a valid signature or proof
into a different valid one for the same message.

For each scheme in use:

- ECDSA: low-s normalization is required (and enforced by
  libzcash_script per Bitcoin BIP-146 and [ZIP-208](https://zips.z.cash/zip-0208)).
- Ed25519: [ZIP-215](https://zips.z.cash/zip-0215) strict rules eliminate the small-subgroup and
  non-canonical encoding malleability paths.
- RedJubjub / RedPallas: re-randomization is *intended*, but the
  randomized key must still verify the same message. Mutation
  without secret knowledge should be infeasible.
- Groth16: knowledge-of-exponent makes proof randomization without
  the secret infeasible, but the encoding (A, B, C) can be malleated
  by adding zero-pairs to the underlying scheme. Read the spec.
- Halo2 IPA: proofs include explicit randomness commitments;
  malleability bounds are part of the IPA security argument.

Review checklist:

- does this scheme treat the message-plus-signature pair as binding,
  or only the message under a known key?
- can two distinct signatures verify for the same (key, message)?
  If yes, document why this is acceptable here.

## Batch Verification Soundness

Batch verifiers reduce a set of n equations to a single equation
using random linear combinations. They are sound under the bilinear
or DLOG assumption when the random scalars are uniform and
unpredictable to the prover.

What to check in `zebra-consensus/src/primitives/`:

- random scalars come from an OS RNG, not a deterministic source.
- batch size is bounded so a malicious prover cannot exhaust memory.
- the fallback path (`tower-fallback`) re-verifies items
  individually when the batch fails. Otherwise an attacker can
  invalidate a whole block by inserting a single bad item.

Review checklist:

- where do the randomizers come from?
- is the batch verifier sound under the same assumptions as the
  individual verifier?
- is the failure mode "reject the batch and surface the bad item"
  rather than "reject everything in the batch silently"?

## Domain Separation and Personal Strings

Every BLAKE2 call in Zcash uses a personal string. Most call sites
have a fixed personal string in the spec; some are parameterized
(notably [ZIP-244](https://zips.z.cash/zip-0244)).

What to check:

- is the personal string exactly 8 bytes? (Some libraries truncate
  or pad silently.)
- is it the same bytes the spec specifies?
- is it included in every hash invocation in this code path, not
  just the first one?
- if the personal string is parameterized, is the parameter the one
  the spec defines? ([ZIP-244](https://zips.z.cash/zip-0244) mixes consensus branch ID into multiple
  personalizations.)

Review checklist:

- find every BLAKE2 call site in the change.
- map each to a spec section.
- compare the bytes literally, not the constant name.

## Edge Cases: Identity, Zero, Small Subgroup

Cryptographic operations have edge cases that are rarely covered by
vector tests. Examples:

- identity point on the curve: many algorithms have a special case
  for the identity; some libraries silently return zero or panic.
- zero scalar: a "signature" with a zero scalar is often valid or
  invalid in unexpected ways; the spec should rule one way.
- small-subgroup elements: Edwards curves like Ed25519 have an
  8-torsion subgroup. [ZIP-215](https://zips.z.cash/zip-0215) mandates explicit rejection.
- field elements above the modulus: see canonical encoding above.
- recipient is sender: shielded transactions where the sender is
  also the recipient can exercise out-viewing-key paths that are
  rarely tested.

Review checklist:

- generate identity, zero, and small-subgroup test inputs and
  exercise the new code with them.
- proptest with biased generators that produce these cases more
  often than uniform.

## Randomness

- `rand::rngs::OsRng` for security-relevant randomness.
- never `rand::thread_rng()` for nonces in cryptographic
  signatures.
- per [ZIP-32](https://zips.z.cash/zip-0032) derivation, randomness from a deterministic source is
  acceptable for diversifier search but not for spend authorizers.

Review checklist:

- find every `rand::` call site.
- classify each as "ok to be predictable" or "must be unpredictable".
- if "must be unpredictable", confirm `OsRng` or equivalent.

## Trusted Setup Assumptions

Sapling Groth16 verification is sound under the q-PKE assumption
*given* the trusted setup was honest. If the MPC was fully
compromised, no Sapling proof verifies meaningful statements.
Orchard Halo2 has no setup, so this concern does not apply.

What this means for review:

- never invent a new Groth16 application in Zcash without a
  corresponding ceremony plan.
- when wrapping new shielded crypto, prefer schemes without trusted
  setup if a credible alternative exists.

## The "Spec Is the Source of Truth" Rule

When the spec and the code disagree, the spec wins. When the spec
and the C++ reference implementation disagree, the spec wins, but
expect a network compatibility incident if you fix only one side.

Concrete practice:

- every consensus-critical port should link to the spec section and
  to the matching `zcash/zcash` C++ line, as the [`zebra-script`](https://github.com/ZcashFoundation/zebra/tree/v4.4.1/zebra-script)
  doc comments do.
- when you find a discrepancy, file an issue on the `zcash/zips`
  repo before changing code.

## A Review Checklist You Can Paste Into PR Reviews

```
- [ ] constant-time concerns documented for any secret-input code.
- [ ] all encodings canonical; round-trip property test added.
- [ ] no new malleability surface (signature, proof, message).
- [ ] batch verifier paired with item-level fallback.
- [ ] every BLAKE2 / SHA / hash call has the correct personal /
      domain-separator bytes, verified against the spec.
- [ ] edge cases tested: identity, zero, small subgroup, recipient
      = sender, max values, min values.
- [ ] randomness sources classified.
- [ ] trusted-setup assumption noted if applicable.
- [ ] spec section linked in the PR description.
- [ ] for any ported zcashd behavior, the C++ source line is linked.
```

## See Also

- 09-threat-model.md.
- 10-incidents-and-audits.md (every incident is a failure of one
  item on this checklist).
- the Zcash Protocol Specification, sections 4 and 5.

## Spec Pointers

- [RFC 7748](https://datatracker.ietf.org/doc/html/rfc7748) for X25519 (used in note encryption).
- [RFC 8032](https://datatracker.ietf.org/doc/html/rfc8032) for Ed25519 (where Zebra still consumes it).
- Zcash spec section 5 for the primitives used by the protocol.

## Exercises

1. Find one place in Zebra where a secret-dependent branch could leak timing. Confirm it is gated by a constant-time primitive.
2. Identify a test vector imported from the protocol spec and confirm it round-trips.
3. Add a benchmark that exercises batch verification on a synthetic 100-signature workload. Compare against single-signature throughput.
