---
sidebar_position: 10
title: "Incidents and Audits"
description: "Published audit findings, post-mortems, and the regressions they left in the test suite."
---

# Incidents and Audits

## Why This Chapter Exists

History repeats itself. Knowing which classes of bug Zebra has shipped before tells you which classes of bug to look for in your PR. The chapter is a punch list of named incidents and the regressions they left in the test suite.

The single best calibration for a principal cryptography engineer is
reading the post-mortems. Below are the well-known incidents in the
Zcash ecosystem and the lessons each one teaches. Verify each entry
against the canonical write-ups; this file is a study guide, not a
substitute for the originals.

## The 2018 Counterfeiting Bug (BCTV14)

The original Sprout zk-SNARK construction was BCTV14, named for the
Ben-Sasson, Chiesa, Tromer, Virza paper. ECC discovered a soundness
flaw in BCTV14 that, if exploited, would have allowed unlimited
counterfeit Sprout coins. The bug was patched silently by migrating
Sprout proofs from BCTV14 to Groth16 in the Sapling network upgrade
(October 2018), then publicly disclosed in February 2019. The total
Sprout pool turnover was monitored to provide an upper bound on any
potential exploitation, and no evidence of exploitation was found.

Lessons:

- proving-system soundness flaws are the worst possible class of bug
  in a privacy chain because exploitation is invisible.
- defense in depth: keep a stable supply audit independent of the
  shielded math, so a quiet draining can be detected statistically.
- ZK soundness arguments deserve formal review and ideally formal
  verification. This is exactly the kind of work where your prior
  Lean / autoformalisation background applies.

References to read end to end:

- ECC blog post "Zcash Counterfeiting Vulnerability Successfully
  Remediated" (February 2019).
- the BCTV14 paper and the Groth16 paper.
- Daira Hopwood's post-mortem.

## [ZIP-216](https://zips.z.cash/zip-0216): Canonical Jubjub Encoding

Pre-NU5 Zcash accepted non-canonical Jubjub point encodings. Two
encodings could decode to the same point if one was canonical and
the other was the result of arithmetic that wrapped past the field
modulus. This is not a soundness flaw on its own, but it created a
*malleability* surface: an attacker could mutate signatures and
proofs by re-encoding points, producing a different transaction with
the same effect. Different implementations could disagree on
acceptance, opening a consensus-split surface as well.

[ZIP-216](https://zips.z.cash/zip-0216) mandates canonical Jubjub encodings at NU5. The activation
required every node implementation to enforce canonicity strictly
from NU5 onwards while still accepting non-canonical historical
encodings before NU5.

Lessons:

- "encoding is part of consensus" is not a slogan, it is a rule.
- canonical-encoding bugs are easy to introduce when wrapping a
  library that does not enforce canonicity by default.
- the migration shape (strict after height H, lenient before) is a
  recurring pattern in Zcash and is a frequent source of off-by-one
  height bugs.

## Sighash Regressions

The most recent example in this repo: v5 transactions with a
`SIGHASH_SINGLE` flag and no corresponding output. [ZIP-244](https://zips.z.cash/zip-0244) section
S.2a states this is a consensus failure; zcashd throws an exception
in `SignatureHash` and `CheckSig` catches it to fail the script.
Zebra did not initially reject this case. The fix shipped as
v4.4.1; the merge commit is `1ec1078e2` and the rejection logic is
in [`zebra-script/src/lib.rs`](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-script/src/lib.rs)'s `calculate_sighash` closure.

Lessons:

- consensus rules expressed as "the C++ throws and the caller
  catches" do not port directly. Every implicit control-flow rule
  must become an explicit check.
- sighash rules are dense with edge cases. The valid v5 hash-type
  bytes are exactly `{0x01, 0x02, 0x03, 0x81, 0x82, 0x83}`; any
  other value must be rejected, also in the same closure.
- the porting discipline "every consensus-critical port links to the
  exact C++ line numbers" exists for a reason. Read the doc
  comments in [`zebra-script/src/lib.rs`](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-script/src/lib.rs) for the established pattern.

## Libzcash_script CVE GHSA-gq4h-3grw-2rhv

Cited in `Cargo.toml` lines 290 to 302. The advisory reproduces
reliably only when the bundled libzcash_script C++ code is compiled
in *release* mode because it relies on a stack buffer not being
zero-initialized (C++ debug-mode arrays are usually zeroed). The
workaround is to force release-level optimization on
`libzcash_script` even in dev builds:

```toml
[profile.dev.package.libzcash_script]
opt-level = 3
debug-assertions = false
overflow-checks = false
incremental = false
codegen-units = 16
```

Lessons:

- C++ FFI is a different security model. Read the C++ side as if you
  do not trust the compiler.
- "only happens in release" is a red flag for memory-safety bugs.
  Test both modes.
- FFI dev-build overrides should be commented with the CVE or issue
  ID that motivated them, as this repo does.

## The Libzcash_script Callback Failure Propagation Issue

Inline at [`zebra-script/src/lib.rs`](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-script/src/lib.rs) around the `calculate_sighash`
closure: the libzcash_script C++ verifier does not propagate
callback failure back through `verify_callback`. Returning `None`
from the Rust callback (the "I cannot compute this sighash") would
silently leak into the verifier and not cause script failure. The
workaround is to return a freshly-generated random 32-byte sighash
so the resulting signature verification fails with overwhelming
probability.

The doc comment in the file explicitly notes: a fixed sentinel would
be unsafe because an attacker who knows the sentinel can construct
an ECDSA signature that verifies against any 32-byte value under a
chosen pubkey.

Lessons:

- "fail closed" requires care when the API is callback-based and the
  framework does not propagate errors.
- a known-fixed bad sentinel is not safe in cryptographic contexts
  where the verifier is adversarial.
- prefer per-call randomness for security workarounds, never a
  hardcoded magic value.

## #10527 Coinbase Sapling Spends

Visible in recent commits. PR #10527 changed something about
coinbase Sapling spend handling and broke proptests, then a follow-
up (`a60ff8345`) restored test coverage. Look up the PR and the
fix to learn what specific edge case existed.

Lessons:

- proptests catch regressions that vector tests miss. A proptest
  failure is information, not noise.
- coinbase transactions are a special case at every layer. Anything
  that "should not happen on coinbase" needs an explicit assertion.

## Historical Testnet Splits

Zcash testnet has had at least one notable consensus split between
Zebra and zcashd in the past several years. Look up the maintainers'
public discussion (Discord, forum, GitHub issues) for the most
recent incidents. The pattern is usually:

1. an implementation accepts a block the other rejects (or vice
   versa).
2. the two halves of the network diverge.
3. the divergent implementation rolls back or fixes; affected
   operators re-sync.

These are excellent reading material because the same patterns
recur. The Zebra Book sections under `book/src/dev/diagrams/` and
the RFC index reference some of these.

## Ongoing Audits

Zebra has been audited by multiple firms; the Zcash Foundation
publishes audit reports on their website. Read at least the most
recent one before doing serious work. The audit findings often
become permanent items in the design vocabulary.

## Recommended Exercise

For each incident above, write three lines:

1. what would have caught it earlier (test, fuzz, formal proof,
   review checklist).
2. what symmetric bug class the reader should look for next.
3. what does Zebra currently do to defend against the symmetric
   bug.

Done once, the threat model in file 09 becomes second nature.

## See Also

- `SECURITY.md` at the repo root.
- 09-threat-model.md.
- 11-cryptographic-correctness-practices.md.
- ECC and ZF security advisories on GitHub.

## Spec Pointers

- The relevant audit PDFs are linked in chapter 08.
- Post-mortems live in [issues labelled C-security](https://github.com/ZcashFoundation/zebra/issues?q=label%3AC-security).

## Exercises

1. Pick one incident from this chapter and run the named regression test. Confirm it still passes.
2. Read one closed issue tagged `C-security` from the last year. Summarize the root cause in one sentence.
3. Identify a class of bug from the audit history that Zebra does not currently lint for. Propose a clippy lint or a custom check.
