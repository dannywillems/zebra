---
sidebar_position: 19
title: "Observability and Debugging"
description: "Tracing, metrics, log levels, and the runtime knobs that let you debug a stuck or forked node."
---

# Observability and Debugging

## Why This Chapter Exists

When a node stalls, you have minutes. The chapter is the list of knobs that buy you those minutes: log levels, trace spans, metrics, runtime flags.

When something goes wrong in production, you have logs, metrics,
and traces. This file is how to use them.

## Tracing

Zebra uses the `tracing` crate. Every span is annotated with
structured fields; every event carries a level and a target.

### Log Levels and Filters

Defaults (per [`zebrad/src/lib.rs`](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebrad/src/lib.rs)): the binary ignores `debug` and
`trace` logs in release builds, courtesy of compile-time tracing
filters. To enable them, set the environment variable
`ZEBRA_LOG_LEVEL=debug` or use the runtime filter API when the
`filter-reload` feature is on.

The convention from [`AGENTS.md`](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/AGENTS.md): production log level must be
`info` or above. Never run mainnet at `debug` level.

### Span Structure

Spans correspond to operations. The important ones to know:

- per-block: `block::verify`, `block::commit`, `block::write`.
- per-transaction: `tx::verify`, `tx::admit`.
- per-peer: `peer::connection`, `peer::handshake`.
- per-RPC call: `rpc::call`, with method name field.

Use `#[instrument(skip(large_arg))]` on instrumented functions; the
existing pattern is consistent.

### Tracing Sinks

[`zebrad/src/components/tracing/`](https://github.com/ZcashFoundation/zebra/tree/v4.4.1/zebrad/src/components/tracing) configures the output:

- stdout / stderr by default.
- file output via `tracing.log_file` config.
- journald via the `journald` feature.
- sentry via the `sentry` feature.
- flamegraph via the `flamegraph` feature.
- tokio-console via the `tokio-console` feature.

### Reading a Log

A useful pattern: when reproducing a bug, redirect the log to a
file, then `grep` for the relevant block height or hash. The
structured-field format makes this easy: `grep 'height=1234567'`.

For consensus mismatches, log both implementations at info-or-debug
and `diff` the event sequences around the divergent height.

## Metrics

Metrics use dot-separated hierarchical names with established
prefixes (per `AGENTS.md`):

- `checkpoint.*`: checkpoint verifier counters.
- `state.*`: state service queue depths and write rates.
- `sync.*`: sync component progress.
- `rpc.*`: RPC method counts and durations.
- `peer.*`: per-peer connection metrics.
- `zcash.chain.*`: chain-state metrics (tip height, value pool
  balances, etc.).

### Prometheus

Behind the `prometheus` Cargo feature, Zebra exposes a `/metrics`
endpoint. The metrics list is documented at
[`book/src/user/metrics.md`](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/book/src/user/metrics.md).

For local development: enable `prometheus`, spin up Prometheus and
Grafana via the `docker-compose.metric.yml` (or whatever the
current name) configuration in `docker/`, and watch a sync in real
time.

### Key Metrics to Watch

- `state.queued_blocks.count`: backlog of out-of-order blocks. If
  this grows unbounded, sync has stalled.
- `sync.checkpoint.height` vs `state.committed.height`: how far
  behind the writer is from the verifier.
- `peer.outbound.count`: peer pool health.
- `mempool.size_bytes`: mempool utilization vs [ZIP-401](https://zips.z.cash/zip-0401) weight
  budget.
- `tx::verify.duration`: per-tx verification cost. Spikes indicate
  pathological transactions or verifier batch failures.

## Tokio-console

With the `tokio-console` feature and the right compile flags
(`book/src/dev/tokio-console.md`), you can attach `tokio-console` to
a running Zebra and inspect tasks, futures, channels, and resource
usage. This is the right tool for diagnosing async stalls.

When to use:

- a service has stopped making progress but is not panicking.
- you suspect a deadlock on a channel.
- you want to see which task is hot.

## Flamegraph

With the `flamegraph` feature, Zebra records tracing spans into a
flamegraph. Useful for finding CPU hotspots in verification.

For lower-overhead profiling, `pprof` and `cargo flamegraph` work
against an externally-running Zebra without re-compilation.

## Debugger Usage

Zebra is `panic = "abort"` in both dev and release profiles, so on
panic the process dies. A debugger attached before the panic can
capture the state.

For async debugging:

- `lldb` and `gdb` both work, but understanding the future state at
  a breakpoint requires familiarity with the Tokio internal
  representation. `tokio-console` is usually faster.
- conditional breakpoints on a specific block height or transaction
  hash localize quickly.

## Bisecting a Regression

Standard `git bisect`:

```
git bisect start
git bisect bad HEAD
git bisect good v4.4.0
git bisect run cargo test -p zebra-consensus --features ... -- specific_test
```

For consensus regressions, run the relevant nextest sync profile in
the bisect script. This is slow but unambiguous.

## Bisecting a Consensus Mismatch

When Zebra and zcashd diverge:

1. capture the block at which they disagree.
2. run both in parallel against the same testnet from an earlier
   checkpoint.
3. capture per-block validation outcome.
4. binary-search backward to the first divergent block.
5. on the divergent block, capture both implementations' detailed
   logs (debug level).
6. compare line by line. The first difference is the bug.

The `zebra-checkpoints` utility and the regtest setup help with
the reproduction.

## The Slow-start-after-idle Warning

Recent commit `d4cd662c7` adds a startup warning if Linux TCP
`net.ipv4.tcp_slow_start_after_idle` is on. This is a real
operational issue (sync stalls after idle periods because TCP
windows reset). The warning is in
[`zebrad/src/components/`](https://github.com/ZcashFoundation/zebra/tree/v4.4.1/zebrad/src/components). If you see this in operator logs, the
fix is `sysctl -w net.ipv4.tcp_slow_start_after_idle=0`.

## The "Health" Endpoint

The `health/` component exposes liveness and readiness HTTP probes.
Documented at [`book/src/user/health.md`](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/book/src/user/health.md). Used by Kubernetes
deployments to know when to restart Zebra.

## A Reference Debugging Kit

The toolset to have ready before day one of operations work:

- a running mainnet Zebra in Docker with logs persisted to disk.
- Prometheus and Grafana with the standard metrics dashboard.
- `tokio-console` configured and reachable.
- a `regtest` setup that brings up a local Zebra + zcashd pair.
- the zcashd `debug.log` reader bookmarked
  (https://github.com/zcash/zcash/blob/master/doc/release-notes/).
- spec quick-lookup PDF open in a tab.

## See Also

- [`book/src/user/tracing.md`](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/book/src/user/tracing.md), [`book/src/user/metrics.md`](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/book/src/user/metrics.md),
  [`book/src/user/health.md`](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/book/src/user/health.md).
- [`book/src/dev/profiling-and-benchmarking.md`](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/book/src/dev/profiling-and-benchmarking.md).
- [`AGENTS.md`](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/AGENTS.md) on logging hygiene and metric naming.

## Spec Pointers

- [tracing](https://docs.rs/tracing/latest/tracing/) documentation.
- `metrics` crate, used by [`zebrad`](https://github.com/ZcashFoundation/zebra/tree/v4.4.1/zebrad) for the Prometheus endpoint.

## Exercises

1. Run `RUST_LOG=zebra_state=debug zebrad start` and confirm the state crate logs are visible.
2. Identify the metric that exposes the current chain height. Curl `/metrics` and read it.
3. Find a long-running operation that is not currently traced. Add `#[instrument]` and confirm it appears.
