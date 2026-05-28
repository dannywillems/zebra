---
sidebar_position: 17
title: "zcashd Parity and Consensus Split Risk"
description: "How Zebra mirrors zcashd consensus, where they have diverged, and how to detect a split before mainnet does."
---

# zcashd Parity and Consensus Split Risk

## Why This Chapter Exists

A consensus split between Zebra and zcashd costs the network confidence and time. The chapter is the procedure for detecting one, locating the divergence, and fixing it without making the split worse.

Zebra exists in a two-implementation network. Both must agree on
every consensus rule, exactly, byte for byte, on every block. Any
disagreement is a consensus split: the network forks into a Zebra
half and a zcashd half until one side capitulates or fixes its bug.

This file is about how to keep that from happening.

## Why Parity Matters

A consensus split is the worst class of operational incident on a
public chain. Effects:

- exchanges and bridges stop, since they cannot trust which fork is
  canonical.
- mining hashpower splits, weakening security on both sides.
- block reorganizations happen as one side wins.
- user funds may become unspendable on the losing side until the
  next coordinated upgrade.

The Bitcoin Cash split (2017) and the Ethereum Classic split (2016)
are reference incidents. Zcash has had at least one notable testnet
split between zcashd and Zebra historically; mainnet has avoided
splits so far through careful compat testing.

## What Consensus Rules Cover

Anything that determines whether a block or transaction is valid:

- block header rules: PoW, difficulty target, version bits, time
  bounds.
- block-body rules: Merkle root, transaction count, total coinbase
  reward, funding-stream payouts, history-tree root.
- transaction structure: version validity by upgrade, expiry,
  fee bounds.
- script execution: every Bitcoin opcode and every Zcash-specific
  rule that applies to transparent inputs.
- sighash: the digest each input commits to.
- shielded validation: proof verification, signature verification,
  binding signatures, value balance.
- value pools: every pool's running balance must stay non-negative.

Any of these can differ between implementations and split the
network.

## Known Divergence Sources (Historical and Structural)

Patterns to watch for:

### Implicit C++ Control Flow

The zcashd implementation throws exceptions where Zebra returns
`Result`. Some consensus rules are encoded as "C++ throws and the
caller catches". The recent v5 SIGHASH_SINGLE / no-corresponding-
output fix (file 10) is exactly this pattern.

### Encoding Tolerance

Permissive encoding in one implementation, strict encoding in the
other. ZIP-216 was a planned tightening of this. Watch for any new
deserialization path that accepts more or fewer encodings than the
spec mandates.

### Integer Overflow Semantics

Rust panics on overflow in debug, wraps in release; C++ undefined-
behaves on signed overflow and wraps on unsigned. The `Amount` type
in `zebra-chain` enforces explicit checked arithmetic to defend
against this divergence. Any direct `as` cast or `u64 +` in
consensus code is a red flag.

### Floating Point

There is none in Zcash consensus. Any FP in a consensus path is a
bug.

### Nondeterministic Iteration

Rust's `HashMap` iteration order varies between runs. Any
consensus output that depends on iteration order over a `HashMap`
will produce nondeterministic results. Use `BTreeMap` for any
ordered consensus-relevant collection.

### Library Upgrades

A bump in `librustzcash`, `orchard`, `sapling-crypto`, or any
crypto crate is a potential consensus risk. `book/src/dev/
ecc-updates.md` documents the Zebra-side process. Always run the
sync tests against testnet and mainnet after such an update.

## Compat Test Infrastructure

### Nextest Integration Profiles

`.config/nextest.toml` defines profiles that run real-chain sync
tests. They are the truest "are we consensus-equivalent" tests.
Profiles include:

- `sync-large-checkpoints-empty`: full testnet sync from genesis.
- variations for different starting states and depths.

These run on CI runners with multi-hour budgets. Run them locally
when you change anything consensus-critical.

### Shielded Proof Vectors

Every cryptographic primitive has known-answer test vectors. Drift
in proof generation or verification is caught here.

### The `Comparison-interpreter` Feature

`zebra-script` has a Cargo feature `comparison-interpreter` that
runs the Rust port of the zcash script interpreter (`zcash_script`)
alongside the C++ `libzcash_script`. They are compared on every
script evaluation and a divergence is logged.

This is the canonical pattern for porting C++ consensus code to
Rust: run both side by side until you have enough confidence to flip
the default.

### Vector Tests Ported From zcashd

`zebra-test/` includes vector test data ported from `zcash/zcash`.
Any update to zcashd's vectors should propagate here. The Zebra
RFC index has a discussion of vector test discipline.

### Regtest and Private Testnet

`book/src/user/regtest.md` and `book/src/user/fork-zebra-testnet.md`
document how to spin up a local network that includes both Zebra
and zcashd nodes for testing consensus parity manually.

## How to Bisect a Divergence

When you see a divergence (a block accepted by one and rejected by
the other, or a different chain tip), the workflow:

1. capture the block in question. Hash, height, full raw bytes.
2. on the rejecting side, get the explicit error. `zebra-state`'s
   error types are specific (`CommitSemanticallyVerifiedError`,
   `ValidateContextError`, etc.). zcashd's debug.log usually has a
   `bad-blk-*` reason.
3. classify: structural (deserialization), semantic (validation
   rule), or contextual (state-dependent).
4. for structural: compare deserialization byte by byte. The Zebra
   deserializer is the spec; if zcashd accepts something Zebra
   rejects, it is usually zcashd being too lenient.
5. for semantic: compare the specific check. Use `comparison-
   interpreter` to localize script issues. For shielded, log the
   exact proof and signature inputs and run them through both
   verifiers offline.
6. for contextual: compare anchor sets, nullifier sets, UTXO sets,
   value pool balances at the parent block height. Differences here
   indicate an earlier divergence; bisect backwards.
7. once isolated, file an issue in `zcash/zips` (if a spec
   ambiguity) or in the offending implementation's repo (if a bug).
8. coordinate a fix release across implementations.

## The "Test on Testnet First" Rule

Every consensus change activates on testnet first, at an earlier
height than mainnet. This window is the operational divergence-
detection mechanism. Operators of mainnet nodes who also run testnet
nodes serve as a distributed early warning system.

If you change anything consensus-relevant, the activation on testnet
is your final test before mainnet.

## A Healthy Paranoia

The Zebra maintainers' policy is to be slow to change consensus
code. Bug-for-bug compatibility with zcashd is preferred over
"correct but different". Where Zebra wants to be stricter than
zcashd, it does so behind a network-upgrade gate so the change
activates at the same height on both implementations.

When in doubt, do not "fix" a perceived bug in consensus code
unless you have confirmed the same fix is going into the other
implementation, at the same activation height, in the same upgrade.

## See Also

- 09-threat-model.md (consensus adversaries).
- 10-incidents-and-audits.md (every entry there is a parity
  incident).
- `book/src/dev/ecc-updates.md`.
- `book/src/dev/continuous-integration.md`.
- the `zcash/zcash` repository, especially `src/main.cpp` and
  `src/script/`.

## Spec Pointers

- `zcashd` source: [zcash/zcash](https://github.com/zcash/zcash).
- The reference test vectors under `zebra-test/`.

## Exercises

1. Find one test vector in `zebra-test/` derived from a `zcashd` test and trace its origin.
2. Identify one place where Zebra and `zcashd` historically disagreed and how it was reconciled (use `git log -S`).
3. Run a regtest sync of a small chain against both implementations and confirm the tip matches.
