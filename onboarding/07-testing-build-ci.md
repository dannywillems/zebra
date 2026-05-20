# 07. testing, build, ci

## the test pyramid in zebra

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

## property testing

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

## fixed test vectors

For consensus parity, Zebra ports vectors from zcashd and the spec
test corpus. Look for files literally named `vectors.rs` and the data
directories under `zebra-test/src/`. Keep the vectors when porting a
new ZIP; they are the most reliable defense against subtle
serialization or hashing bugs.

## ffi-related test setup

`Cargo.toml` overrides `[profile.dev.package.libzcash_script]` to
opt-level 3 (lines 296 to 302). The comment cites the advisory
`GHSA-gq4h-3grw-2rhv` which only reproduces in release mode because
C++ array zero-initialization in debug mode masks the buffer issue.
Keep this in mind any time you debug something that "only happens in
release".

## ci

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

## release process

Documented in `book/src/dev/release-process.md` and
`.github/workflows/`. Releases are tagged on `main`. Versioning is
documented in the same file. `release.toml` configures
`cargo-release`.

The `CHANGELOG.md` is the authoritative user-facing change record.
Per `AGENTS.md`, any user-visible change requires a `CHANGELOG`
update in `[Unreleased]` plus a per-crate `CHANGELOG.md` for
library-consumer-visible changes.

## docker

`docker/` holds the Dockerfiles and entrypoint shell. The production
images are published as `zfnd/zebra` on Docker Hub. Read
`book/src/user/docker.md` and `book/src/user/mining-docker.md` for
how operators actually run Zebra.

## benchmarks and profiling

`book/src/dev/profiling-and-benchmarking.md` is the canonical guide.
Tools mentioned: `tracing-flame`, `pprof`, `cargo flamegraph`,
`tokio-console`. Benchmarks live under `benches/` directories in the
relevant crates (mostly `zebra-chain` for serialization and
hashing).

## what "done" looks like for a pr

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

## suggested exercises

1. run the full CI sequence locally and time each step.
2. write a proptest for one of the simpler types in `zebra-chain`
   (for example `Height` arithmetic) and run it under `nextest`.
3. open `.github/workflows/tests-unit.yml` and identify the exact
   test commands CI runs. Reproduce them locally.
4. read `book/src/dev/state-db-upgrades.md`. Sketch what a
   hypothetical database migration would look like for adding a new
   column family.
