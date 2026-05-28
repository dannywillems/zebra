---
sidebar_position: 16
title: "Formalisation Opportunities"
description: "Concrete places in the consensus rules and crypto layer where a formal proof would change the cost of audit."
---

# Formalisation Opportunities

## Why This Chapter Exists

Some of these rules are well-defined and would benefit from a Lean or Coq proof. Others are not. The chapter is opinionated: it lists what is ripe and what is not, with the reasoning.

This file is specifically for you. Your prior Lean / Mathlib /
CSLib autoformalisation work positions you to do high-leverage
formal verification on cryptographic specifications that are
currently checked only by review and tests. This file maps the
candidates.

## Why Formalise

Zcash's privacy guarantees rest on the soundness of a small number
of mathematical constructions and on the correctness of their byte-
level implementations. Formal verification catches the class of bugs
that escape review (encoding mismatches, missing edge cases,
incorrect domain separation) and the class that test vectors cannot
exhaustively cover (algebraic identities, security reductions).

Several pieces are not currently formalised anywhere. Your work
could establish the first machine-checked specification of these
constructions.

## Low-hanging Targets (Specifications)

The following are pure math, well-scoped, and well-documented.

### blake2 Personal-string Registry

A relational specification: every Zcash hash invocation maps to a
specific 8-byte personal string and a specific input schema. A
formalisation as a Lean datatype indexed by call site would catch
personal-string mismatches at the type level when wrappers are
generated.

References:
- spec appendices: hash personalizations table.
- `librustzcash` source: grep `Personal::`.

### [ZIP-244](https://zips.z.cash/zip-0244) Transaction Id and Sighash

A purely deterministic, finitely-typed computation: given a
transaction, compute a 32-byte digest. Recursive structure mirrors
the per-pool digest tree.

Formalisation work:
- define `Transaction` as an inductive type with v5 fields.
- define each per-pool digest as a function over the structure.
- prove a determinism property (same input gives same output).
- prove an injectivity property where appropriate (different
  authorizations give different sighashes).
- run the test vectors as `decide`-able propositions.

This is the most concrete, smallest, most useful first target.

### Canonical Encoding ([ZIP-216](https://zips.z.cash/zip-0216))

A round-trip property: for any byte string, `parse` then `encode`
is identity, and `parse` rejects non-canonical inputs. Lean's
`decide` tactic handles small concrete cases; for the parameterized
case you need a proof.

This generalizes: every consensus-critical encoding in Zcash has a
round-trip property. Formalising a few of them establishes the
pattern.

### Amount and Value-balance Arithmetic

[`zebra-chain/src/amount.rs`](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-chain/src/amount.rs) and `value_balance.rs` encode
consensus-critical integer-arithmetic invariants. The type system
already prevents some classes of bug; a Lean formalisation could
prove the type discipline correct.

This is small, self-contained, and would catch real bugs.

### Difficulty Adjustment

The PoW median-time-past difficulty adjustment is a deterministic
function of the last `PoWAveragingWindow` blocks. Formalising the
arithmetic over the rolling window would catch off-by-one errors
that have caused testnet incidents in PoW chains.

### History Tree ([ZIP-221](https://zips.z.cash/zip-0221))

An incremental MMR with explicit balance and root computation.
Mathlib already has trees; a formalisation here is constructing the
specific MMR shape and proving its concat / append operations.

## Medium-difficulty Targets (Algebraic Constructions)

### Pedersen and Sinsemilla

Both are committing hash functions over fixed bases. Formalising
their algebraic properties (collision resistance under DLOG) is
substantial work, but the *definitional* version (state the
construction precisely and prove it well-typed) is tractable.

Mathlib has elliptic curve definitions; the bridge is to use them
with the specific Jubjub or Pallas curves.

### Value Commitments and Binding Signatures

The homomorphism: sum of value commitments equals commitment to
sum, times generator. This is a one-line algebraic identity. Proving
it in Lean against the Mathlib elliptic curve abstractions is a
clean exercise and demonstrates the binding-signature soundness
argument.

## Hard Targets (Proof-system Soundness)

### groth16 Verification Equation

The pairing-product verification equation is the consensus-relevant
side of Groth16. Formalising:
- the verification equation as a Prop.
- the relationship to the proving statement.
- the batch verification randomization (in particular, that the
  random combination preserves soundness with overwhelming
  probability).

This intersects with existing work on the formal verification of
SNARK verifiers (Lurk, snarkVM auditors, academic projects).
Coordinate with anyone already working in this area.

### halo2 IPA Verifier

The inner-product argument verifier is more complex but well-
specified. The `halo2_proofs` codebase is the reference.

A small first step: formalise the polynomial commitment scheme
underlying Halo2 IPA and prove the binding property.

## Proving-system-adjacent Work in the Ecosystem

Check for existing formal work before duplicating:

- the `lurk-rs` and `snarkVM` ecosystems have ongoing formal
  verification efforts on adjacent constructions.
- the `verified-zk` and `circom-zk-formal` academic projects.
- IETF's CFRG hash and elliptic-curve work, some of which has been
  partially formalised in Coq and Lean.
- `formal-circuits` from the Aztec ecosystem.

Avoid restating existing work; instead, build on top of it.

## Tooling Recommendations

Given your stated preferences in `~/.claude/rules/lean.md`:

- Lean 4 with Mathlib for general math.
- CSLib if relevant for processes or automata reasoning (less likely
  here).
- write specifications as `def` and `theorem` pairs that compile
  fast; avoid heavy proof-search dependencies in performance-
  sensitive specs.
- annotate definitions with `@[scoped grind =]` for automation.

For round-trip property tests in Lean, the `decide` tactic over
small concrete inputs is fast; for large inputs, prefer general
proofs.

## Proposed Concrete Projects (Pick One to Start)

In rough order of impact-per-week:

1. [ZIP-244](https://zips.z.cash/zip-0244) sighash formalisation with all test vectors as
   `decide`-able propositions. Two to four weeks of work; immediately
   useful.
2. canonical encoding round-trip lemmas for Jubjub and Pallas
   compressed points. One to two weeks; reusable lemma pattern.
3. amount arithmetic + value balance invariants. One week; small,
   high-confidence.
4. BLAKE2 personal-string registry as a typed enumeration. One
   week; catches a real bug class.
5. binding-signature homomorphism. One to two weeks; demonstrates
   the algebraic style.
6. anything Groth16 or Halo2 related. Multiple months; coordinate
   widely first.

## How to Use This

After your first sync of mainnet (day one), pick item 1 above and
spend a few hours sketching the Lean datatype. Drop the sketch into
a `notes/` directory in your own fork and present it on the next
Zebra dev call. Even at the sketch stage this is a contribution
that no one else is making.

## See Also

- 11-cryptographic-correctness-practices.md (informal version of
  the same discipline).
- `~/.claude/rules/lean.md` (your own Lean conventions).
- the Mathlib FieldTheory and AlgebraicGeometry directories.

## Spec Pointers

- Mathlib4 modules listed in `~/.claude/rules/lean.md` for the relevant primitives.
- The Zcash protocol spec, sections 3 and 5, for the rules most easily lifted to formal statements.

## Exercises

1. Pick one consensus rule and write a one-paragraph informal statement of the theorem you would prove about it.
2. Search Mathlib for the smallest set of definitions you would need to encode that theorem.
3. List one rule from the spec that is *not* a good formalisation target and explain why.
