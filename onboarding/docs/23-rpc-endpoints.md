---
sidebar_position: 23
title: "RPC Endpoints Reference"
description: "Index of every JSON-RPC method and gRPC streaming endpoint that zebrad exposes, with categories, signatures, source pointers, and authentication notes."
---

# RPC Endpoints Reference

## Why This Chapter Exists

The narrative for the RPC layer lives in
[chapter 05](./05-network-and-rpc.md). This chapter is the flat
reference: every JSON-RPC method and every gRPC streaming endpoint
that [`zebra-rpc`](https://github.com/ZcashFoundation/zebra/tree/v4.4.1/zebra-rpc) exposes, in a single grep-friendly index, with
the signature, the source line, and the access category.

Use this page to answer "does Zebra implement `<method>`?" without
reading the 3000-line [`zebra-rpc/src/methods.rs`](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-rpc/src/methods.rs) trait by hand.

## Configuration

Both RPC servers are **disabled by default**. They are opted in
through the `[rpc]` config section, with the following fields
(from [`zebra-rpc/src/config/rpc.rs`](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-rpc/src/config/rpc.rs)):

```rust reference title="zebra-rpc/src/config/rpc.rs (Config struct)"
https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-rpc/src/config/rpc.rs#L9-L72
```

Recommended ports follow the `zcashd` convention:

| Network | JSON-RPC default port | Indexer gRPC default port    |
| ------- | --------------------- | ---------------------------- |
| Mainnet | `127.0.0.1:8232`      | `127.0.0.1:8230` (suggested) |
| Testnet | `127.0.0.1:18232`     | `127.0.0.1:18230` (suggested) |

The indexer gRPC server additionally requires the `indexer` Cargo
feature at build time. See "Indexer gRPC" below.

## Authentication and Exposure

- Cookie auth is on by default for JSON-RPC (`enable_cookie_auth =
  true`). The cookie file is written under `cookie_dir` at startup
  and must accompany every request. Clients on the same host can
  read the file; remote clients cannot.
- There is **no built-in rate limiting**. If `listen_addr` is bound
  to a public IP, every method below is reachable by every actor on
  the internet; some of them (`sendrawtransaction`,
  `submitblock`, `generate`, `invalidateblock`, `addnode`, `stop`)
  are state-changing. Bind to `127.0.0.1` unless a reverse proxy
  with auth and rate limiting sits in front.
- `max_response_body_size` caps the per-response body in bytes.
  Default is large enough for full blocks but not unbounded.

For the broader security stance (rate limiting, header-based auth,
binding discipline), see `~/.claude/rules/security-audit.md` and
[chapter 09](./09-threat-model.md).

## JSON-RPC: The `Rpc` Trait

Every method below is declared on a single [jsonrpsee](https://github.com/paritytech/jsonrpsee) trait:

```rust reference title="zebra-rpc/src/methods.rs (Rpc trait declaration)"
https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-rpc/src/methods.rs#L177-L196
```

The full trait is just under 800 lines; each `#[method(name =
"...")]` attribute declares a JSON-RPC method name as `zcashd`
would expect it. The tables below group the 37 methods by purpose.

### Blockchain Queries

Read-only queries that need only the local chain state.

| Method (RPC name)              | Signature (Rust)                                                                                                                       | Source                                                                                                                                                                       |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getinfo`                      | `async fn get_info() -> Result<GetInfoResponse>`                                                                                       | [methods.rs#L194-L195](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-rpc/src/methods.rs#L194-L195)                                                              |
| `getblockchaininfo`            | `async fn get_blockchain_info() -> Result<GetBlockchainInfoResponse>`                                                                  | [methods.rs#L207-L208](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-rpc/src/methods.rs#L207-L208)                                                              |
| `getbestblockhash`             | `fn get_best_block_hash() -> Result<GetBlockHashResponse>`                                                                             | [methods.rs#L316-L317](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-rpc/src/methods.rs#L316-L317)                                                              |
| `getbestblockheightandhash`    | `fn get_best_block_height_and_hash() -> Result<GetBlockHeightAndHashResponse>`                                                         | [methods.rs#L324-L325](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-rpc/src/methods.rs#L324-L325)                                                              |
| `getblockcount`                | `fn get_block_count() -> Result<u32>`                                                                                                  | [methods.rs#L484-L485](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-rpc/src/methods.rs#L484-L485)                                                              |
| `getblockhash`                 | `async fn get_block_hash(index: i32) -> Result<GetBlockHashResponse>`                                                                  | [methods.rs#L502-L503](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-rpc/src/methods.rs#L502-L503)                                                              |
| `getblock`                     | `async fn get_block(hash_or_height: String, verbosity: Option<u8>) -> Result<GetBlockResponse>`                                        | [methods.rs#L280-L281](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-rpc/src/methods.rs#L280-L281)                                                              |
| `getblockheader`               | `async fn get_block_header(hash_or_height: String, verbose: Option<bool>) -> Result<GetBlockHeaderResponse>`                           | [methods.rs#L304-L305](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-rpc/src/methods.rs#L304-L305)                                                              |
| `getblocksubsidy`              | `async fn get_block_subsidy(height: Option<u32>) -> Result<GetBlockSubsidyResponse>`                                                   | [methods.rs#L665-L666](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-rpc/src/methods.rs#L665-L666)                                                              |
| `getdifficulty`                | `async fn get_difficulty() -> Result<f64>`                                                                                             | [methods.rs#L673-L674](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-rpc/src/methods.rs#L673-L674)                                                              |

### Shielded-Aware Queries

Reads that touch the Sapling or Orchard note commitment trees.
See [chapter 03 on anchors](./03-cryptography.md) for the
underlying data structure.

| Method                  | Signature                                                                                                              | Source                                                                                                                          |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `z_gettreestate`        | `async fn z_get_treestate(hash_or_height: String) -> Result<GetTreestateResponse>`                                     | [methods.rs#L361-L362](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-rpc/src/methods.rs#L361-L362)                 |
| `z_getsubtreesbyindex`  | `async fn z_get_subtrees_by_index(pool: String, start_index: NoteCommitmentSubtreeIndex, limit: Option<u16>) -> ...`   | [methods.rs#L382-L383](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-rpc/src/methods.rs#L382-L383)                 |
| `z_validateaddress`     | `async fn z_validate_address(address: String) -> Result<ZValidateAddressResponse>`                                     | [methods.rs#L648-L649](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-rpc/src/methods.rs#L648-L649)                 |
| `z_listunifiedreceivers`| `async fn z_list_unified_receivers(...)`                                                                               | [methods.rs#L689-L690](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-rpc/src/methods.rs#L689-L690)                 |

The `z_getsubtreesbyindex` method feeds [ZIP-307](https://zips.z.cash/zip-0307) (lightwalletd-style
streaming) clients. The matching indexing column families
(`sapling_note_commitment_subtree`,
`orchard_note_commitment_subtree`) are listed in
[chapter 04's storage section](./04-consensus-and-state.md).

### Transaction and Mempool

Mempool reads plus transaction submission. The `sendrawtransaction`
endpoint is the only public-facing write that does not require an
admin privilege.

| Method                | Signature                                                                                                                         | Source                                                                                                                          |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `getmempoolinfo`      | `async fn get_mempool_info() -> Result<GetMempoolInfoResponse>`                                                                   | [methods.rs#L330-L331](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-rpc/src/methods.rs#L330-L331)                 |
| `getrawmempool`       | `async fn get_raw_mempool(verbose: Option<bool>) -> Result<GetRawMempoolResponse>`                                                | [methods.rs#L342-L343](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-rpc/src/methods.rs#L342-L343)                 |
| `getrawtransaction`   | `async fn get_raw_transaction(txid: String, verbose: Option<u8>, block_hash: Option<String>) -> Result<GetRawTransactionResponse>` | [methods.rs#L401-L402](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-rpc/src/methods.rs#L401-L402)                 |
| `sendrawtransaction`  | `async fn send_raw_transaction(hex: String, max_fee_rate: Option<f64>) -> Result<SendRawTransactionResponse>`                     | [methods.rs#L254-L255](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-rpc/src/methods.rs#L254-L255)                 |
| `gettxout`            | `async fn get_tx_out(txid: String, index: u32, include_mempool: Option<bool>) -> Result<...>`                                     | [methods.rs#L760-L761](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-rpc/src/methods.rs#L760-L761)                 |

### Address-Indexed Lookups

These three rely on the per-transparent-address indexing column
families (`balance_by_transparent_addr`,
`tx_loc_by_transparent_addr_loc`,
`utxo_loc_by_transparent_addr_loc`) catalogued in
[chapter 04's storage section](./04-consensus-and-state.md). They
are the surface that wallets and explorers consume.

| Method                | Signature                                                                                                | Source                                                                                                                          |
| --------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `getaddressbalance`   | `async fn get_address_balance(address_strings: AddressStrings) -> Result<AddressBalance>`                | [methods.rs#L232-L233](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-rpc/src/methods.rs#L232-L233)                 |
| `getaddresstxids`     | `async fn get_address_tx_ids(request: GetAddressTxIdsRequest) -> Result<Vec<String>>`                    | [methods.rs#L438-L439](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-rpc/src/methods.rs#L438-L439)                 |
| `getaddressutxos`     | `async fn get_address_utxos(address_strings: AddressStrings) -> Result<Vec<GetAddressUtxos>>`            | [methods.rs#L459-L460](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-rpc/src/methods.rs#L459-L460)                 |

### Mining

The `getblocktemplate` / `submitblock` pair is the
miner-facing surface; the mining-info, hash-rate, and network-solps
queries support it. `generate` is regtest-only and panics on
mainnet.

| Method                | Signature                                                                                                       | Source                                                                                                                          |
| --------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `getblocktemplate`    | `async fn get_block_template(parameters: Option<JsonParameters>) -> Result<...>`                                | [methods.rs#L526-L527](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-rpc/src/methods.rs#L526-L527)                 |
| `submitblock`         | `async fn submit_block(hex_data: HexData, _options: Option<...>) -> Result<...>`                                | [methods.rs#L547-L548](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-rpc/src/methods.rs#L547-L548)                 |
| `getmininginfo`       | `async fn get_mining_info() -> Result<GetMiningInfoResponse>`                                                   | [methods.rs#L559-L560](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-rpc/src/methods.rs#L559-L560)                 |
| `getnetworksolps`     | `async fn get_network_sol_ps(num_blocks: Option<i32>, height: Option<i32>) -> Result<u64>`                      | [methods.rs#L572-L573](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-rpc/src/methods.rs#L572-L573)                 |
| `getnetworkhashps`    | `async fn get_network_hash_ps(num_blocks: Option<i32>, height: Option<i32>) -> Result<u64>`                     | [methods.rs#L585-L586](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-rpc/src/methods.rs#L585-L586)                 |
| `generate`            | `async fn generate(num_blocks: u32) -> Result<Vec<GetBlockHashResponse>>`                                       | [methods.rs#L713-L727](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-rpc/src/methods.rs#L713-L727)                 |

### Network and Peer Management

| Method            | Signature                                                                          | Source                                                                                                                          |
| ----------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `getnetworkinfo`  | `async fn get_network_info() -> Result<GetNetworkInfoResponse>`                    | [methods.rs#L599-L600](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-rpc/src/methods.rs#L599-L600)                 |
| `getpeerinfo`     | `async fn get_peer_info() -> Result<Vec<PeerInfo>>`                                | [methods.rs#L607-L608](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-rpc/src/methods.rs#L607-L608)                 |
| `ping`            | `async fn ping() -> Result<()>`                                                    | [methods.rs#L618-L619](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-rpc/src/methods.rs#L618-L619)                 |
| `addnode`         | `async fn add_node(addr: PeerSocketAddr, command: AddNodeCommand) -> Result<()>`   | [methods.rs#L729-L744](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-rpc/src/methods.rs#L729-L744)                 |
| `validateaddress` | `async fn validate_address(address: String) -> Result<ValidateAddressResponse>`    | [methods.rs#L631-L632](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-rpc/src/methods.rs#L631-L632)                 |

### Admin and Chain Surgery

State-changing endpoints used for node administration and (in the
case of `invalidateblock` / `reconsiderblock`) manual fork
management. Treat as production-dangerous; do not expose externally.

| Method             | Signature                                                              | Source                                                                                                                          |
| ------------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `stop`             | `fn stop() -> Result<String>`                                          | [methods.rs#L475-L476](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-rpc/src/methods.rs#L475-L476)                 |
| `invalidateblock`  | `async fn invalidate_block(block_hash: String) -> Result<()>`          | [methods.rs#L702-L703](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-rpc/src/methods.rs#L702-L703)                 |
| `reconsiderblock`  | `async fn reconsider_block(block_hash: String) -> Result<Vec<block::Hash>>` | [methods.rs#L710-L711](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-rpc/src/methods.rs#L710-L711)                 |

### Discovery

A single OpenRPC discovery endpoint returns the machine-readable
schema for all of the above.

| Method          | Signature                                          | Source                                                                                                                          |
| --------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `rpc.discover`  | `fn openrpc() -> openrpsee::openrpc::Response`     | [methods.rs#L747-L748](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-rpc/src/methods.rs#L747-L748)                 |

## Indexer gRPC (Streaming)

Opt-in via the `indexer` Cargo feature plus
`rpc.indexer_listen_addr`. The protobuf is at
[`zebra-rpc/proto/indexer.proto`](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-rpc/proto/indexer.proto):

```protobuf reference title="zebra-rpc/proto/indexer.proto (service)"
https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-rpc/proto/indexer.proto#L48-L57
```

| RPC                         | Direction          | Payload                  | Purpose                                                                          |
| --------------------------- | ------------------ | ------------------------ | -------------------------------------------------------------------------------- |
| `ChainTipChange`            | server-streaming   | `BlockHashAndHeight`     | Notify every change of the best chain tip.                                       |
| `NonFinalizedStateChange`   | server-streaming   | `BlockAndHash`           | Notify every block appended to the non-finalized fork forest.                    |
| `MempoolChange`             | server-streaming   | `MempoolChangeMessage`   | Notify ADDED / INVALIDATED / MINED for every mempool transition.                 |

These streams are how [Zaino](https://github.com/zingolabs/zaino)
and similar indexers stay live without polling. Server-streaming
means one request, many responses; the client closes the stream to
unsubscribe.

## Failure Modes

- **Public binding without a reverse proxy.** Every write endpoint
  becomes attacker-controlled. Bind to `127.0.0.1` or put a
  reverse proxy with auth and rate limiting in front. The
  `listen_addr` doc comment in [`zebra-rpc/src/config/rpc.rs`](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-rpc/src/config/rpc.rs)
  calls this out explicitly.
- **Cookie auth disabled in error.** Setting `enable_cookie_auth =
  false` makes every method on `listen_addr` unauthenticated. Only
  do this when something else (mutual TLS, network ACL) provides
  the boundary.
- **`generate` on mainnet.** The method exists but panics outside
  regtest. If you see it called, the caller is confused, not
  malicious.
- **`invalidateblock` outside a coordinated rollback.** The
  finalized state cannot be rewound; calling this on a finalized
  block is a no-op but logs an error.
- **gRPC stream backpressure.** The three indexer streams will
  drop notifications under sustained slow consumers. A client that
  treats stream delivery as a write-ahead log will diverge from the
  node.

## Spec Pointers

- [`zebra-rpc/src/methods.rs`](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-rpc/src/methods.rs): the single source of truth
  for the JSON-RPC trait. Implementation lives under [`zebra-rpc/src/methods/`](https://github.com/ZcashFoundation/zebra/tree/v4.4.1/zebra-rpc/src/methods).
- [`zebra-rpc/proto/indexer.proto`](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-rpc/proto/indexer.proto): the gRPC schema.
- [`zebra-rpc/src/config/rpc.rs`](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-rpc/src/config/rpc.rs): server configuration.
- [`zebra-rpc/src/server.rs`](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-rpc/src/server.rs): how the trait is wired to the
  jsonrpsee server.
- The matching `zcashd` RPC reference for behavioural compatibility
  expectations.
- For consuming the surface: [Zaino](https://github.com/zingolabs/zaino),
  [Zallet](https://github.com/zcash/wallet),
  [`librustzcash`](https://github.com/zcash/librustzcash) (wallet-side).

## Exercises

1. Pick one method from the **Admin** table and trace its
   implementation under [`zebra-rpc/src/methods/`](https://github.com/ZcashFoundation/zebra/tree/v4.4.1/zebra-rpc/src/methods). Identify
   every state mutation it performs and the Tower service it goes
   through.
2. The `getrawtransaction` method accepts an optional `block_hash`.
   Find the code path that uses it and explain in two sentences
   what the parameter changes about the lookup.
3. Start Zebra with `[rpc] listen_addr = '127.0.0.1:8232'` and
   `enable_cookie_auth = true`. From the same host, invoke
   `getinfo` using `curl` and the cookie file. From a different
   host on the LAN, confirm the same call fails with 401.
4. Add a debug log inside `MempoolChange` that prints `change_type`
   per notification. Run against testnet for ten minutes and
   summarise the distribution of ADDED vs INVALIDATED vs MINED.

## Further Reading

- [Chapter 05](./05-network-and-rpc.md) for the narrative
  introduction to the RPC layer.
- [Chapter 18](./18-mempool-mining-and-wallet-ecosystem.md) for
  how this surface composes with mining (`getblocktemplate`) and
  wallets (Zaino / Zallet).
- [Chapter 04](./04-consensus-and-state.md) for the indexing
  column families that back the address-indexed and shielded
  subtree methods.
