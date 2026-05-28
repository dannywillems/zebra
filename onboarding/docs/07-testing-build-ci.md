---
sidebar_position: 7
title: "Testing, Build, and CI"
description: "Unit, property, integration, and acceptance tests. Local commands versus GitHub Actions workflows."
---

# Testing, Build, and CI

## Why This Chapter Exists

No code lands without this chapter. Every PR runs the same gates locally and in CI. If you cannot reproduce a CI failure locally, you cannot fix it. The chapter is short on purpose: it lists the commands and the failure modes.

## The Test Pyramid in Zebra

Tests are layered:

- unit tests, colocated under `src/**/tests/`. Files commonly named
  `vectors.rs` (known-answer test vectors, usually from the spec or
  zcashd), `prop.rs` (proptest property tests), `preallocate.rs`
  (allocation-bound tests for deserializers).
- integration tests, under each crate's top-level `tests/`
  directory. These exercise crate-public APIs.
- workspace-level acceptance tests in `zebrad/tests/`. These spawn
  `zebrad` as a subprocess and drive it.
- network sync tests, also in `zebrad/tests/`, organized into
  nextest profiles in `.config/nextest.toml`.

Run them with the obvious command:

```
cargo test --workspace
cargo test -p zebra-chain
cargo test -p zebra-chain -- test_name
```

For better output and parallelism use `nextest`:

```
cargo nextest run
cargo nextest run --profile sync-large-checkpoints-empty
```

The nextest profiles are how CI organizes long-running sync tests.
They are documented in `book/src/dev/continuous-integration.md`.

## Property Testing

Every consensus-relevant type implements `proptest::Arbitrary` (gated
behind the `proptest-impl` feature). This is what makes "for any
valid transaction, serialize then deserialize is identity" tests
feasible at scale. The `zebra-test` crate aggregates shared
generators.

Read `zebra-chain/src/tests.rs` and any of the `prop.rs` files. The
patterns to learn:

- generators bounded by network upgrade. v5 transactions can only be
  generated under network upgrades where v5 is valid.
- `LedgerState`, the proptest-helper type that lets a generator know
  which height, network, and upgrade it should target.

## Fixed Test Vectors

For consensus parity, Zebra ports vectors from zcashd and the spec
test corpus. Look for files literally named `vectors.rs` and the data
directories under `zebra-test/src/`. Keep the vectors when porting a
new ZIP; they are the most reliable defense against subtle
serialization or hashing bugs.

## Ffi-related Test Setup

`Cargo.toml` overrides `[profile.dev.package.libzcash_script]` to
opt-level 3 (lines 296 to 302). The comment cites the advisory
`GHSA-gq4h-3grw-2rhv` which only reproduces in release mode because
C++ array zero-initialization in debug mode masks the buffer issue.
Keep this in mind any time you debug something that "only happens in
release".

## Ci

CI runs via GitHub Actions; the entry point is
`.github/workflows/`. The architecture is documented at
`.github/workflows/README.md` and reproduced at the bottom of the
top-level README.

Key workflows:

- `tests-unit.yml`: unit tests across the workspace.
- `lint.yml`: formatting and clippy.
- `zfnd-ci-integration-tests-gcp.yml`: integration sync tests on
  GCP-hosted runners.
- `book.yml`: builds and deploys the Zebra Book.
- `zfnd-deploy-nodes-gcp.yml`: deploys canary `zebrad` nodes.

## Release Process

Documented in `book/src/dev/release-process.md` and
`.github/workflows/`. Releases are tagged on `main`. Versioning is
documented in the same file. `release.toml` configures
`cargo-release`.

The `CHANGELOG.md` is the authoritative user-facing change record.
Per `AGENTS.md`, any user-visible change requires a `CHANGELOG`
update in `[Unreleased]` plus a per-crate `CHANGELOG.md` for
library-consumer-visible changes.

## Docker

`docker/` holds the Dockerfiles and entrypoint shell. The production
images are published as `zfnd/zebra` on Docker Hub. Read
`book/src/user/docker.md` and `book/src/user/mining-docker.md` for
how operators actually run Zebra.

## Benchmarks and Profiling

`book/src/dev/profiling-and-benchmarking.md` is the canonical guide.
Tools mentioned: `tracing-flame`, `pprof`, `cargo flamegraph`,
`tokio-console`. Benchmarks live under `benches/` directories in the
relevant crates (mostly `zebra-chain` for serialization and
hashing).

## What "Done" Looks Like for a Pr

Per the contribution gate in `AGENTS.md`, before opening a PR:

1. confirm scope. Zebra is a validator node.
2. keep the change focused.
3. run formatting, lint, and tests locally:

```
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
```

4. prepare PR metadata: linked issue, motivation, solution, test
   evidence.
5. disclose AI tooling if used.

The contribution gate is a hard requirement: there must be a
maintainer-acknowledged issue before any PR is opened. The CLAUDE.md
file in this repo enforces this for any AI-assisted work as well.

## Suggested Exercises

1. run the full CI sequence locally and time each step.
2. write a proptest for one of the simpler types in `zebra-chain`
   (for example `Height` arithmetic) and run it under `nextest`.
3. open `.github/workflows/tests-unit.yml` and identify the exact
   test commands CI runs. Reproduce them locally.
4. read `book/src/dev/state-db-upgrades.md`. Sketch what a
   hypothetical database migration would look like for adding a new
   column family.

## Spec Pointers

- `.github/workflows/`: the CI graph the local commands mirror.
- `cargo nextest` profiles in `.config/nextest.toml` (if present) for the integration-test matrix.

## Exercises

1. Run `cargo fmt --all -- --check && cargo clippy --workspace --all-targets -- -D warnings && cargo test --workspace`. Confirm it passes on a clean checkout.
2. Identify one CI workflow that runs only on tag pushes and explain what it does.
3. Add a comment to a test, push it on a feature branch, and confirm the relevant CI job runs.
