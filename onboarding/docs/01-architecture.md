---
sidebar_position: 1
title: "Workspace, Dependency Graph, and Build"
description: "The 12 Zebra crates, how they depend on each other, and the build commands you run every day."
---

# Workspace, Dependency Graph, and Build

## Why This Chapter Exists

This is the map. You return here every time you need to remember which crate owns what, where a request flows, and which Cargo command exercises a given piece. Without this picture, every other chapter is a sequence of disconnected facts. By the end you should be able to point at any source file and say which crate it belongs to and which of its tests would catch a regression there.

## The 12 Crates

Zebra is a single Cargo workspace. The canonical members list lives
in `Cargo.toml` at the repo root, pinned here to `v4.4.1`:

```toml reference title="Cargo.toml"
https://github.com/ZcashFoundation/zebra/blob/v4.4.1/Cargo.toml#L1-L20
```

`zebra-grpc` and `zebra-scan` directories exist on disk but are not
in the workspace; check `Cargo.toml` for the current canonical list
before assuming anything.

## The Dependency Graph

```
                       zebrad
                  (CLI + orchestration)
                          |
        +-----------------+-----------------+--------+
        |                 |                 |        |
   zebra-consensus    zebra-network    zebra-state   |
        |                 |                 |        |
        |                 |                 |   zebra-rpc
        |  zebra-script (FFI to             |        |
        |  libzcash_script C++)             |        |
        |                 |                 |        |
        +-----------+-----+-----+-----------+--------+
                    |           |
                    |    zebra-node-services
                    |    (service trait aliases)
                    |           |
                    +-----+-----+
                          |
                     zebra-chain
              (pure types, sync only, no tokio)

   tower-batch-control, tower-fallback: custom Tower middleware
   zebra-test:                          test infrastructure
   zebra-utils:                         standalone tools, checkpoint gen
```

Three rules to remember:

1. dependencies flow downward only. Lower crates must not depend on
   higher ones.
2. `zebra-chain` is sync-only. No async, no tokio, no Tower.
3. `zebra-node-services` exists to break what would otherwise be
   cyclic dependencies between crates that need each other's service
   trait shapes (mempool, RPC, state).

## Per-crate Role at a Glance

- `zebra-chain`: the consensus-critical data type layer. Blocks,
  transactions (v1 through v5/v6), Sprout/Sapling/Orchard primitives,
  parameters, network upgrades, serialization, work and difficulty,
  history trees, value pools.
- `zebra-script`: thin wrapper around `libzcash_script` (the C++
  Zcash script interpreter from zcashd). Lives in its own crate so
  the `unsafe_code` deny attribute can stay on for the rest of the
  workspace.
- `zebra-consensus`: semantic verification. Verifies blocks and
  transactions as Tower services. Holds verifier batches for Groth16,
  Halo2, RedJubjub, RedPallas, Ed25519.
- `zebra-state`: contextual verification plus storage. Splits writes
  (`Request`) from reads (`ReadRequest`). Holds the finalized state
  in RocksDB and the non-finalized state as a tree of forks.
- `zebra-network`: Tower-based P2P. Encapsulates the Bitcoin-derived
  Zcash wire protocol and exposes a `PeerSet` service representing
  "the rest of the network".
- `zebra-rpc`: JSON-RPC (zcashd-compatible) and indexer gRPC.
- `zebra-node-services`: shared service trait aliases (`Mempool`,
  `RpcClient`, etc.), no logic.
- `zebrad`: the binary. CLI commands, abscissa-based application,
  components (sync, inbound, mempool, miner, metrics, tracing). It
  wires everything together.
- `tower-batch-control`: middleware that batches requests so an
  inner service can verify them with a batch verifier. Used for
  Groth16, Halo2, RedJubjub, RedPallas, Ed25519.
- `tower-fallback`: middleware that retries a request on a fallback
  service. Used for batched verifiers that can fall back to a
  per-item verifier on batch failure.
- `zebra-test`: shared test infrastructure, fixed test vectors,
  network fixtures.
- `zebra-utils`: standalone utilities (checkpoint generation,
  block hash computation, search-issue, openapi generator, etc.).

## The Workspace Cargo File

`Cargo.toml` at the repo root pins workspace-wide dependency versions
and lint policy. Read it once end to end:

- `workspace.dependencies` (lines 31 to 174) is the dependency
  catalog. The cryptographic surface is visible here: `orchard`,
  `sapling-crypto`, `zcash_proofs`, `zcash_primitives`,
  `zcash_protocol`, `zcash_history`, `zcash_keys`, `zcash_transparent`,
  `bls12_381`, `jubjub`, `halo2`, `bellman`, `equihash`, `reddsa`,
  `redjubjub`, `ed25519-zebra`, `secp256k1`, `blake2b_simd`,
  `blake2s_simd`, `ripemd`, `sha2`, `bs58`, `bech32`,
  `incrementalmerkletree`, `libzcash_script`, `zcash_script`. Most of
  these crates are maintained by ECC/ZF; you will end up reading their
  source as well.
- `profile.dev` overrides for crypto crates (lines 192 to 302) force
  opt-level 3 on hot paths even in debug mode. Note the comment on
  `libzcash_script` referencing a real CVE: that override exists so
  the C++ test path reproduces the bug reliably.
- `workspace.lints` (lines 325 to 378) define the policy. Key
  entries: `unsafe_code = "deny"`, `non_ascii_idents = "deny"`,
  `missing_docs = "warn"`, plus clippy lints biased toward
  consensus-correct integer arithmetic (`checked_conversions`,
  `implicit_saturating_sub`, `invalid_upcast_comparisons`,
  `range_minus_one`, `range_plus_one`, `unnecessary_cast`) and
  Tower-friendly async (`await_holding_lock`).

## Build Prerequisites

From the README:

- Rust toolchain. `rust-toolchain.toml` pins `channel = "stable"`.
  Per `Cargo.toml`, the workspace MSRV is 1.85.1 for libraries and
  the `zebrad` binary itself targets 1.91 per `AGENTS.md`.
- libclang (for bindgen, used by RocksDB).
- a C++ compiler (for `libzcash_script` and RocksDB).
- protoc, optional, only required for some gRPC paths.

## Build, Test, Lint Commands

The canonical CI sequence is documented in `AGENTS.md`:

```
cargo build --workspace --locked
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
```

For broader coverage, the CI uses nextest profiles. See
`.config/nextest.toml` for the profile list. The integration sync
profiles (`sync-large-checkpoints-empty`, etc.) drive a real chain
sync against testnet and are the most realistic end-to-end test.

## Feature Flags Worth Knowing

From `zebrad/src/lib.rs` doc comments:

- `progress-bar`: progress bars in the terminal; default on.
- `prometheus`: export metrics on `/metrics`.
- `journald`, `sentry`, `flamegraph`: tracing sinks.
- `filter-reload`: runtime tracing filter changes.
- `tokio-console`: enables `console-subscriber`.
- `proptest-impl`: enables randomised test data generators
  re-exported from `zebra-chain::tests` (and similar test
  scaffolding from other crates).
- `lightwalletd-grpc-tests`: enables tests that talk to
  `lightwalletd`.
- `elasticsearch`: writes block data to Elasticsearch (experimental).
- `internal-miner`: in-process miner, testnet only.
- `indexer`: enables the indexer-specific request/response types in
  `zebra-state` and `zebra-rpc`.

For the `zebra-state` crate specifically, the `proptest-impl` and
`indexer` features unlock additional public re-exports
(`zebra-state/src/lib.rs`).

## Docs and Book

- `book/src/SUMMARY.md` is the table of contents for the Zebra Book.
  The developer section under `book/src/dev/` contains the RFCs that
  document Zebra's architecture decisions. Read all RFCs at least
  once.
- `docs/decisions/` holds long-form ADR-style decision logs.
- the internal API docs (rustdoc) are built and published at
  `https://zebra.zfnd.org/internal`. Generate them locally with
  `cargo doc --workspace --no-deps --open`.

## What You Should Be Able to Do After Reading This File

- name each of the 12 crates and what it owns.
- explain why `zebra-chain` is sync-only.
- explain why `zebra-script` and `zebra-node-services` exist as
  separate crates.
- locate any cryptographic dependency in `Cargo.toml`.
- run the full CI sequence locally.

## Spec Pointers

- `Cargo.toml` at the repo root: workspace declaration and the canonical crate list.
- `book/src/SUMMARY.md`: the upstream Zebra book; treat it as the navigable index for design docs.
- `.github/workflows/`: the CI graph that translates the local commands in this chapter to the gates that block merges upstream.

## Exercises

1. Open `Cargo.toml` and list every workspace member that is *not* declared here but exists on disk (hint: there are at least two). Explain why each is excluded.
2. Run `cargo test -p zebra-chain block::serialize::tests::block_test_vectors` and identify which test vectors are loaded. Cite the file and line.
3. Add a `zebra-script` test that fails on purpose (e.g. assert false). Confirm `cargo test --workspace` catches it. Revert.
