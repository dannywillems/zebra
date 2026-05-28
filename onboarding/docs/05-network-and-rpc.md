---
sidebar_position: 5
title: "Networking and JSON-RPC"
description: "The peer gossip layer in zebra-network and the zcashd-compatible RPC surface in zebra-rpc."
---

# Networking and JSON-RPC

## Why This Chapter Exists

Two surfaces, both attacker-controlled. `zebra-network` is the gossip layer (P2P, attackers connect to it); `zebra-rpc` is the local management surface (less hostile, still untrusted in shared environments). If you contribute here, you are in the part of the codebase most likely to ship a CVE.

## zebra-network

The module-level doc in `zebra-network/src/lib.rs` is the best
single document on the Zebra P2P design. Read it end to end before
you read any subdirectory.

The architecture in one paragraph: the Zcash network protocol is
Bitcoin-derived and stateful (any message may be a request or a
response depending on context). Zebra wraps that legacy protocol into
a stateless, request-response oriented protocol defined by
`Request` and `Response` enums in `protocol::internal`. The whole
peer set is exposed as a single Tower service that load-balances
outbound requests over available peers. Inbound requests are dispatched
to a Tower service supplied by the caller.

### `Protocol/`

Two layers:

- `external/`: the wire-format types. `message.rs` is the canonical
  list of every Zcash P2P message. `codec/` is the Tokio `Codec`
  implementation that frames messages on a TCP stream. `addr/`
  decodes/encodes peer addresses (v1 and v2 variants). `inv.rs`
  defines the inventory item type used in `inv`/`getdata`. `types.rs`
  defines `PeerServices`, `Nonce`, `Version`.
- `internal/`: the Zebra-internal request/response abstraction.
  `request.rs` and `response.rs` are the Tower interfaces every other
  crate uses. `response_status.rs` adds an extra Zebra-side
  response status type for partial inventory responses.

### `Peer/`

Per-connection state. Each peer has:

- a `Connection` task (`peer/connection/`), which is the per-peer
  state machine. It accepts internal `Request`s, dispatches them as
  outbound wire messages, accepts inbound wire messages and routes
  them either as responses to outstanding requests or as inbound
  requests to the caller's service.
- a `Client` service (`peer/client/`), the external handle other
  code uses to send a request to one specific peer.
- a `Handshake` (`peer/handshake/`), which performs the Zcash
  `version`/`verack` exchange (with Tor-style anonymization
  toggles, see `isolated/`).
- a `Connector` (`peer/connector.rs`) that combines TCP dial plus
  handshake.

### `Peer_set/`

The connection pool.

- `set/` is the load-balanced multi-peer Tower service. It picks a
  peer per outbound request using inventory-aware routing.
- `inventory_registry/` tracks which peer advertised which inventory
  item, so we route block and tx requests to peers that have them.
- `candidate_set/` is the pool of address-book entries that have not
  yet been tried.
- `initialize/` is the startup logic: load seeds, resolve DNS, load
  cached peers from disk, kick off outbound dial loop, spawn the
  listener task.
- `limit.rs` enforces inbound and outbound connection bounds.
- `unready_service.rs` is the small utility for "park a service
  that is not currently ready for the next request without losing it".
- `stall_tracker/` records last-heard timestamps so we can drop
  stuck peers.

### `Address_book*`

The address book is in `address_book.rs` and friends. It is the
in-memory list of `MetaAddr`s (peer address plus attempt metadata).
`address_book_updater.rs` reconciles updates from many peer tasks
into one canonical view. `peer_cache_updater.rs` persists the address
book to disk on a timer.

### `policies.rs`

Tower retry policy.

### `Isolated/`

The anonymizing connector. The TCP and Tor (currently disabled, see
the comment in `lib.rs`) variants. Used to send user-generated
transactions without revealing the sender's IP.

### Things to Internalize

- the request/response inversion. From outside, "the network" is a
  single Tower service. From the inside of a connection, an inbound
  message can be a response to one of *our* requests or a request
  *to* us. Both cases share the same connection state machine.
- the "drop on overload" pattern. Inbound queues have a finite
  depth; when they fill, the connection is dropped. This is DoS
  defense and the right pattern for adversarial networks.
- `PeerSet` and `Inventory` decouple gossip from peer identity. A
  request for a block can go to any peer that advertised that block,
  not a specific one.

## zebra-rpc

The module-level doc is sparse; the right entry point is `methods/`.

### Structure

- `server/`: HTTP server using `jsonrpsee`. Mounted in
  `zebrad`'s startup.
- `methods/types/`: per-method DTOs. Read this directory directly
  to see the full RPC surface.
- `methods.rs` and `methods/`: the handler implementations.
- `queue/`: the transaction queue used by the mempool RPC flow.
- `indexer/`: a gRPC indexer service. Separate from JSON-RPC.
- `sync.rs`: the synchronization helpers used by mempool/template
  RPC paths.
- `client.rs`: a small JSON-RPC client used internally for tests and
  utilities.

### RPC Methods to Know

`methods/types/` lists them by name. The ones that exercise the
interesting code paths:

- `getblockchaininfo`, `getblockcount`, `getbestblockhash`,
  `getblock`, `getblockheader`: read paths through the state
  service.
- `sendrawtransaction`: full transaction verification path. Touches
  every cryptographic verifier.
- `getrawmempool`, `getmempoolinfo`: mempool views.
- `getblocktemplate`, `submitblock`: mining flow. The most complex
  RPCs because they build a candidate block (coinbase, transactions
  pulled from mempool, default roots, expiry, long-poll support).
  Read `get_block_template/` and `long_poll.rs`.
- `validateaddress`, `z_validateaddress`: shielded and transparent
  address parsing.
- `getpeerinfo`, `getnetworkinfo`: introspection into
  `zebra-network`.

### zcashd Compatibility

Zebra targets the JSON-RPC of `zcashd` so that mining pools and
existing wallets (lightwalletd) can use Zebra without change. Every
method's wire format and error code is meant to match zcashd.
Compatibility tests exist under
`zebra-rpc/src/tests/`; integration tests run a real `lightwalletd`
against a syncing `zebrad`.

### The Indexer

The indexer (gRPC, behind the `indexer` feature) exposes additional
data not present in the JSON-RPC, including spend lookups and
historical chain data. This is the API that wallet servers like
Zaino consume.

## The Mempool

The mempool is split between `zebrad/src/components/mempool/` (the
orchestration) and `zebra-rpc/src/queue/` (the RPC-side queue). The
mempool spec lives at `book/src/dev/mempool-specification.md`; read
it before reading the code.

Key consensus rules to know:

- transactions in the mempool must verify against the current tip
  context. On reorg, mempool entries are re-verified.
- transactions expire on a per-height basis using ZIP-203 expiry.
- a separate "transaction queue" feeds the mempool: transactions
  enter via `sendrawtransaction` or peer gossip, queue up, then
  flush into the mempool batch by batch.

## Suggested Exercises

1. open `zebra-network/src/protocol/external/message.rs` and list
   every Zcash P2P message type. For each, identify whether it is a
   request, a response, or unsolicited.
2. follow a `getblocks` request from a peer. Which task receives
   it, which service answers it, which response message goes out?
3. open `zebra-rpc/src/methods/types/get_block_template/` and
   sketch the full lifecycle of a `getblocktemplate` long-poll.
4. find every place where `MAX_TX_INV_IN_SENT_MESSAGE` is used. Why
   is there a limit, and why this number?

## Spec Pointers

- Bitcoin/Zcash P2P protocol: `zebra-network/src/protocol/`.
- zcashd RPC reference for the methods Zebra must emulate.
- `TrustedPreallocate` discipline: required reading before allocating from any external byte stream.

## Exercises

1. Find one `TrustedPreallocate` impl and explain in one sentence what bound it enforces.
2. Identify one RPC method that has no rate limit in Zebra today. Decide whether the omission is safe and explain why.
3. Add a debug log to the inbound peer handshake that prints the user agent. Run against testnet and confirm the log fires.
