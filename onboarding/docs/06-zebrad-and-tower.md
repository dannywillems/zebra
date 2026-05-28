---
sidebar_position: 6
title: "zebrad and the Tower Pattern"
description: "How the binary wires services together via Tower, backpressure, and structured shutdown."
---

# zebrad and the Tower Pattern

## Why This Chapter Exists

[`zebrad`](https://github.com/ZcashFoundation/zebra/tree/v4.4.1/zebrad) is the binary. It does almost no logic itself; it wires Tower services into a graph. Until you can read a `tower::Service` and know what `poll_ready` returning `Pending` means in this graph, the rest of the codebase reads as magic.

## Tower in Three Sentences

A `tower::Service<Request>` is an asynchronous function from
`Request` to `Result<Response, Error>` with two extras: a
`poll_ready` method that signals backpressure ("not ready yet, do not
call me"), and a `call` method that returns a future. Tower lets you
compose services by wrapping them in middleware: rate limiting,
timeouts, batching, retries, load balancing, all become layers around
an inner service. Zebra is built on Tower throughout, so reading
Zebra without internalizing Tower is going to feel arbitrary.

The bounds Zebra puts on every service in [`AGENTS.md`](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/AGENTS.md):

```
S: Service<Req, Response = Resp, Error = BoxError> + Send + Clone + 'static,
S::Future: Send + 'static,
```

Two non-obvious rules from [`AGENTS.md`](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/AGENTS.md):

- `poll_ready` must check *all* inner services, not just the one
  Tower thinks it should check.
- clone services before moving into async blocks. Cloning a Tower
  service is cheap (it usually contains channels and `Arc`s); moving
  the original into a task makes the service unusable from the
  caller's site.

## Tower-batch-control

A middleware crate. Lives at `tower-batch-control/`. Used to batch
many requests of one type so an inner service can verify them in one
call.

The shape:

- a `Batch<Service, Request>` wraps a service that accepts batches.
- callers send individual requests; they are buffered up to a maximum
  count or maximum wait time.
- when either threshold trips, the batch is dispatched and the
  results are sent back to the individual callers' futures.

Used in [`zebra-consensus/src/primitives/`](https://github.com/ZcashFoundation/zebra/tree/v4.4.1/zebra-consensus/src/primitives) for every batched
verifier: Groth16, Halo2, Ed25519, RedJubjub, RedPallas.

Files to read:

- [`tower-batch-control/src/service.rs`](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/tower-batch-control/src/service.rs): the batched service itself.
- [`tower-batch-control/src/worker.rs`](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/tower-batch-control/src/worker.rs): the worker task that drains
  the batch.
- [`tower-batch-control/src/layer.rs`](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/tower-batch-control/src/layer.rs): the Tower `Layer` adapter.

## Tower-fallback

Pairs naturally with [`tower-batch-control`](https://github.com/ZcashFoundation/zebra/tree/v4.4.1/tower-batch-control). When a batch fails as a
whole (one bad item invalidates the whole batch), the fallback
service re-runs each item individually so the offending one can be
identified and reported. Lives at `tower-fallback/`.

Read [`tower-fallback/src/service.rs`](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/tower-fallback/src/service.rs) to see the simple "try
primary, then fallback" semantics.

## zebrad

The binary. Built on `abscissa`, a small CLI/application framework.

### Entry Points

[`zebrad/src/bin/`](https://github.com/ZcashFoundation/zebra/tree/v4.4.1/zebrad/src/bin) holds the binary entry point. `zebrad/src/
application.rs` wires the application: command parsing, config
loading, component startup. [`zebrad/src/commands/`](https://github.com/ZcashFoundation/zebra/tree/v4.4.1/zebrad/src/commands) lists each
subcommand: `start`, `generate` (config), `copy_state`,
`tip_height`, plus `entry_point.rs` and `tests.rs`.

`start.rs` is the meat. It launches the components.

### Components

[`zebrad/src/components/`](https://github.com/ZcashFoundation/zebra/tree/v4.4.1/zebrad/src/components):

- `tokio.rs`: builds the Tokio runtime with appropriate worker counts.
- `tracing/`: configures `tracing-subscriber` and the various sinks
  (stdout, file, journald, sentry, flamegraph, console-subscriber).
- `metrics.rs`: optional Prometheus exporter.
- `sync/`: the chain syncer. Drives initial block download and
  ongoing tip following. Sends `Request::BlocksByHash`/
  `Request::BlocksByRange` to the peer set, hands blocks to the
  consensus router, then to the state writer.
- `inbound/`: the inbound service handed to `zebra-network::init`.
  Receives requests from peers (`GetBlocks`, `GetData`, `Inv`,
  `Tx`, etc.) and dispatches them to the state, mempool, or
  consensus services.
- `mempool/`: the mempool implementation. Read `book/src/dev/
  mempool-specification.md` first.
- `miner.rs`: optional in-process miner (testnet only with the
  `internal-miner` feature; the documented production setup uses an
  external pool talking to `getblocktemplate`).
- `health/`: HTTP health endpoints for Kubernetes-style liveness and
  readiness checks. See [`book/src/user/health.md`](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/book/src/user/health.md).

The orchestration pattern in `start.rs` is worth memorizing: every
component is a `tower::Service` or task that gets started, connected
to its peers and downstreams via channels or service clones, and
shutdown is propagated through `oneshot` channels and graceful drop
order.

### Config

[`zebrad/src/config.rs`](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebrad/src/config.rs) defines the top-level `ZebradConfig`. Sub-
configs live in the relevant crates: `zebra-network::Config`,
`zebra-state::Config`, `zebra-consensus::Config`,
`zebra-rpc::config::Config`, etc. The full TOML is documented in
[`book/src/user/run.md`](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/book/src/user/run.md) and generated by `zebrad generate`.

A pattern called out in [`AGENTS.md`](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/AGENTS.md): every config struct uses
`#[serde(deny_unknown_fields, default)]` so unrecognized fields are
errors but old configs remain valid as defaults fill in new fields.

## The Parallel Verification RFC

The single most important document for understanding the
shape of Zebra's runtime is RFC 0002, "Parallel Verification", at
[`book/src/dev/rfcs/0002-parallel-verification.md`](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/book/src/dev/rfcs/0002-parallel-verification.md). Read it before
or alongside this file.

The idea: blocks can be verified in arbitrary order as long as their
state dependencies (UTXOs, anchors, nullifier sets) are resolved by
the state service. The state service queues requests until their
dependencies are met. Combined with batched cryptography, this lets
Zebra verify many blocks in flight.

## Suggested Exercises

1. read RFC 0002 and 0004 in [`book/src/dev/rfcs/`](https://github.com/ZcashFoundation/zebra/tree/v4.4.1/book/src/dev/rfcs). Then open
   [`zebrad/src/components/sync/`](https://github.com/ZcashFoundation/zebra/tree/v4.4.1/zebrad/src/components/sync) and find the place that turns "I
   got a block from a peer" into "the block is in
   `non_finalized_state`".
2. find the place where the inbound service is constructed and
   passed to `zebra_network::init`. What `Request` variants does it
   handle?
3. open any verifier in [`zebra-consensus/src/primitives/`](https://github.com/ZcashFoundation/zebra/tree/v4.4.1/zebra-consensus/src/primitives) and trace
   how [`tower-batch-control`](https://github.com/ZcashFoundation/zebra/tree/v4.4.1/tower-batch-control) and [`tower-fallback`](https://github.com/ZcashFoundation/zebra/tree/v4.4.1/tower-fallback) are layered
   together.
4. read [`zebrad/src/components/mempool/`](https://github.com/ZcashFoundation/zebra/tree/v4.4.1/zebrad/src/components/mempool) alongside the mempool spec.
   What is the difference between the "transaction queue" and the
   mempool?

## Spec Pointers

- [Tower documentation](https://docs.rs/tower/latest/tower/).
- [`tower-batch-control`](https://github.com/ZcashFoundation/zebra/tree/v4.4.1/tower-batch-control) and [`tower-fallback`](https://github.com/ZcashFoundation/zebra/tree/v4.4.1/tower-fallback) in this workspace: the project-specific Tower glue.

## Exercises

1. Find the entry point of `zebrad start` and list every service it constructs in order.
2. Pick one service and trace where `poll_ready` is implemented. What backpressure does it expose?
3. Add a metric (`zebrad.startup.duration_ms` or similar) that fires once at startup. Confirm it appears in `/metrics`.
