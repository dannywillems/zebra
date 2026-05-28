---
sidebar_position: 22
title: "First 90 Days"
description: "A reading and contribution plan that converges on a real PR you can plausibly open."
---

# First 90 Days

## Why This Chapter Exists

The course converges here. This is the chapter you read once you have read everything else, and then revisit weekly. It contains the contribution gate, the reading order, and the first PR you should plausibly open.

A concrete, executable plan for the first three months. Adjust to
your actual situation; deviation is expected.

## Week 0 (Before Start)

If you have not started yet:

- finish reading files 01 through 04 of this onboarding.
- skim files 09 through 12 to build the protocol-history vocabulary.
- watch a recent Arborist call or any cross-implementation meeting
  recording you can find.
- set up your Zcash development environment: clone Zebra, install
  Rust 1.91+, libclang, protoc; build `cargo build --workspace
  --locked` once to validate the toolchain.

## Week 1: Get a Mainnet Node Running

Goals:

- sync Zebra to mainnet tip on your own machine or a cloud VM.
- familiarize with operations: logs, metrics, health endpoint.
- introduce yourself to the team.

Day-by-day:

- **day 1**: start `zebrad start` on mainnet against an empty
  database. Walk through the startup logs. Identify each component
  starting (state, network, mempool, sync, RPC).
- **day 2**: enable Prometheus (`prometheus` feature) and a local
  Grafana. Watch the metrics dashboard as sync proceeds. Identify
  the `sync.*`, `state.*`, `peer.*` namespaces from real data.
- **day 3**: read `book/src/user/run.md`, `metrics.md`, and
  `tracing.md`. Configure tracing to a file.
- **day 4**: introduce yourself in the ZF Discord (zebra-dev or
  similar). Mention you are joining ZODL and ask for the cadence
  of cross-team calls.
- **day 5**: sync finishes (or is far along). Use `getblockchain
  info`, `getblockcount`, `getbestblockhash` to verify tip. Compare
  with public block explorers.
- **weekend**: read files 05, 06, 07 of this onboarding.

## Week 2: Shadow Review

Goals:

- start reading the codebase end to end.
- shadow-review three open PRs.

Day-by-day:

- **day 1**: read all 12 Zebra RFCs in `book/src/dev/rfcs/`. They
  are short and they are the architectural source of truth.
- **day 2**: pick three recently-merged PRs from `main`. For each,
  read the diff and ask whether the reader would have caught the
  issues a maintainer caught. Compare to the actual review
  comments. This is the single best way to calibrate review
  judgment.
- **day 3**: read [`zebra-chain/src/lib.rs`](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-chain/src/lib.rs) and the top-level files
  of each [`zebra-chain`](https://github.com/ZcashFoundation/zebra/tree/v4.4.1/zebra-chain) submodule. Build a mental directory.
- **day 4**: read [`zebra-consensus/src/lib.rs`](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-consensus/src/lib.rs) and walk through one
  primitive verifier (`groth16/`, `halo2.rs`, or `redjubjub/`).
- **day 5**: in your fork's onboarding branch, add notes from this
  week's reading. Push them.
- **weekend**: read files 08, 13, 14 of this onboarding.

## Week 3: Dive Deep on Cryptography

Goals:

- become fluent with one specific cryptographic primitive end to
  end.
- pick the formalisation target.

Day-by-day:

- **day 1**: pick [ZIP-244](https://zips.z.cash/zip-0244) sighash as the deep dive target. Open the
  spec section, the ZIP, the [`zebra-chain`](https://github.com/ZcashFoundation/zebra/tree/v4.4.1/zebra-chain) code, and the
  `zcash_primitives` code in parallel.
- **day 2**: trace one example sighash computation from raw
  transaction bytes through every BLAKE2 call. Write your trace down
  as a numbered sequence of inputs and personal strings.
- **day 3**: compare your trace to the [ZIP-244](https://zips.z.cash/zip-0244) test vectors. They
  should match byte for byte.
- **day 4**: read file 16 of this onboarding. Pick a formalisation
  target. Outline a Lean datatype for v5 transactions.
- **day 5**: write a one-page note proposing the formalisation
  target ("formalise X because Y") and circulate it to a ZF or
  ZODL contact. Request feedback.
- **weekend**: read files 09 through 11 of this onboarding.

## Week 4: Networking and RPC

Goals:

- understand the full P2P message flow.
- understand the full JSON-RPC surface.

Day-by-day:

- **day 1**: read [`zebra-network/src/lib.rs`](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-network/src/lib.rs) end to end. Open a
  packet capture against your running node and identify each
  message type by hand.
- **day 2**: read [`zebra-network/src/protocol/external/message.rs`](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-network/src/protocol/external/message.rs)
  and `zebra-network/src/peer/connection/`. Trace one inbound and
  one outbound request.
- **day 3**: read `zebra-rpc/src/methods/` end to end. List every
  RPC method by name and what it returns.
- **day 4**: call every RPC method by hand against your node using
  curl or a JSON-RPC client. Verify the response shapes match what
  you expect.
- **day 5**: read file 18 of this onboarding. Try `getblock
  template` once.
- **weekend**: read files 15, 17 of this onboarding.

## Week 5: Testing and Debugging

Goals:

- run the full CI suite locally.
- bisect a synthetic regression.

Day-by-day:

- **day 1**: run `cargo test --workspace` locally. Identify any
  flaky tests; do not yet try to fix them.
- **day 2**: pick one nextest sync profile and run it. Watch what it
  does.
- **day 3**: introduce a synthetic bug (in your fork only) that
  breaks one consensus check. Watch the test failures. Revert.
- **day 4**: run `tokio-console` against your live node. Identify
  the busy tasks.
- **day 5**: read file 19 of this onboarding. Configure your
  debugging kit.
- **weekend**: read files 20, 21 of this onboarding.

## Weeks 6 to 8: First Contribution

Goals:

- discuss a small first contribution with maintainers.
- prepare it carefully.

Steps:

- pick an open issue tagged `good-first-issue` or
  `S-needs-design`. Avoid anything consensus-critical for the first
  PR; pick documentation, tooling, or test coverage.
- discuss the approach on Discord and in a comment on the issue.
  Wait for a maintainer to acknowledge.
- prepare the change in your fork's branch. Run the full CI sequence
  locally. Include a CHANGELOG entry per `AGENTS.md` rules.
- request review when the maintainer is ready.

Do **not** rush this. The contribution gate exists for a reason; a
hasty first PR is the worst possible first impression.

## Weeks 9 to 12: Become Useful

Goals:

- review at least three external PRs publicly.
- complete a piece of formalisation or audit work.
- co-author or lead-review a draft ZIP if one is in scope.

By the end of week 12, you should be able to:

- read any commit in [`zebra-chain`](https://github.com/ZcashFoundation/zebra/tree/v4.4.1/zebra-chain) or [`zebra-consensus`](https://github.com/ZcashFoundation/zebra/tree/v4.4.1/zebra-consensus) and
  predict whether tests will pass.
- look at a block at a given height and say which consensus rules
  apply.
- name every cryptographic primitive used in Zcash and the crate
  that owns it.
- review a cryptographic PR against the checklist in file 11.
- contribute to a ZIP discussion knowledgeably.

## What Not to Do in the First 90 Days

- do not open a PR against `ZcashFoundation/zebra` without a
  maintainer-acknowledged issue. The contribution gate in
  `AGENTS.md` is binding.
- do not propose consensus changes in your first month. Listen
  first.
- do not assume your prior experience translates directly. Zcash
  has its own customs and vocabulary.
- do not skip the Discord introductions. The maintainers will help
  you if they know who you are.
- do not let perfect be the enemy of good. A small, well-scoped
  contribution beats a perfect contribution that takes six months.

## Ongoing Habits

- read every `zcash/zips` PR as it comes in.
- attend the cross-implementation calls (Arborist or current
  equivalent).
- keep this onboarding folder updated. When you learn something the
  files do not say, add it.
- maintain a personal incidents-and-bugs log. Every bug you find
  goes in; review the log monthly.

## See Also

- all other files in this onboarding.
- `AGENTS.md` for the binding contribution policy.
- `book/src/dev/CONTRIBUTING.md` for the maintainer-facing version.

## Spec Pointers

- Upstream [`CLAUDE.md`](https://github.com/ZcashFoundation/zebra/blob/main/CLAUDE.md) for the contribution gate.
- The fork's [issues page](https://github.com/dannywillems/zebra/issues) for the running list of follow-ups.

## Exercises

1. Identify a `good first issue` in the upstream tracker and read the existing discussion. Decide whether you understand it well enough to comment.
2. Run the full local test suite (`cargo test --workspace`) and record how long it takes.
3. Pick one chapter you skipped and read it. Note one thing the rest of the course misrepresents about it.
