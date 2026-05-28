---
sidebar_position: 18
title: "Mempool, Mining, and the Wallet Ecosystem"
description: "What Zebra exposes for mempool, mining (Stratum/getblocktemplate), and the wallets that talk to it (Zaino, Zallet)."
---

# Mempool, Mining, and the Wallet Ecosystem

## Why This Chapter Exists

Zebra is a validator node. Wallets, miners, and explorers consume it. You must know where Zebra's responsibility ends and theirs begins, or you will accept PRs that drag those scopes into Zebra.

The operational realities at the boundaries of the validator node.
Even though Zebra is "only" a validator, every interaction with
wallets, mining pools, indexers, and lightclients flows through
these three surfaces.

## The Mempool

The spec is at [`book/src/dev/mempool-specification.md`](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/book/src/dev/mempool-specification.md). Read it
end to end before reading this file.

### Invariants the Mempool Must Maintain

1. every transaction in the mempool must verify against the current
   chain tip context (anchor existence, nullifier non-revealedness,
   UTXO presence, transparent expiry).
2. on reorg, mempool entries must be re-verified against the new
   tip. Some entries may become invalid.
3. an unconfirmed nullifier or UTXO must not be reused. The mempool
   tracks unconfirmed spends to prevent inclusion of conflicting
   transactions in a block template.
4. value-pool consistency: mempool entries must respect per-pool
   value constraints in aggregate.
5. expiry: transactions with a height-based expiry past the current
   tip are evicted.

### Admission Rules

A transaction is admitted to the mempool if it passes:

- structural validation (well-formed bytes).
- semantic validation (signatures, proofs, scripts, sigops).
- contextual validation (anchors, nullifiers, UTXOs).
- mempool-specific limits (fee minimums, size bounds, [ZIP-401](https://zips.z.cash/zip-0401) weight
  limits).
- non-conflict with existing mempool entries.

### [ZIP-401](https://zips.z.cash/zip-0401) Anti-dos

[ZIP-401](https://zips.z.cash/zip-0401) defines the weight-based admission rules that bound mempool
memory and CPU costs. Each transaction has a weight (a function of
size, sigops, proof count). The mempool maintains a total weight
budget; when full, it evicts by lowest fee-per-weight. The exact
formula is in the ZIP; verify against the current spec section.

### Eviction Order

- expired transactions first.
- transactions made invalid by a reorg next.
- on-overflow, lowest-fee-per-weight last.

The "transaction queue" (`zebra-rpc/src/queue/`) is the staging
buffer in front of the mempool. New transactions arrive here from
`sendrawtransaction` or peer gossip, batch-verify, then flush into
the mempool.

### Mempool Sources

In Zebra, the mempool is split between [`zebra-rpc/src/queue/`](https://github.com/ZcashFoundation/zebra/tree/v4.4.1/zebra-rpc/src/queue) (the
RPC-facing queue) and [`zebrad/src/components/mempool/`](https://github.com/ZcashFoundation/zebra/tree/v4.4.1/zebrad/src/components/mempool) (the
component running the rules). The split exists because the queue
needs to be reachable from the RPC handlers, while the mempool
proper is owned by the orchestrator.

The relevant diagram is at `book/src/dev/diagrams/
mempool-architecture.md`.

## Mining and getblocktemplate

Mining pools and miners interact with Zebra through JSON-RPC. The
key methods:

- `getblocktemplate` (proposal mode and template mode).
- `submitblock`.
- `getblocksubsidy`, `getmininginfo`, `getnetworkhashps`.

### The getblocktemplate Flow

The full sequence, end to end:

1. miner calls `getblocktemplate` with optional long-poll ID.
2. Zebra builds a candidate block:
   - selects transactions from the mempool by fee-per-weight,
     subject to size and sigop limits.
   - constructs the coinbase transaction including the funding-
     stream / NSM payouts at the per-height required addresses.
   - computes default roots (Merkle root, tree roots, history root,
     authdigest root for NU5+).
   - serializes the template as JSON-RPC response.
3. miner builds candidate blocks by varying the nonce, the
   ExtraNonce in coinbase, and (optionally) the Equihash solution.
4. on finding a valid Equihash solution + difficulty, miner submits
   via `submitblock`.
5. Zebra validates the submission as a full block, commits if valid.
6. long-poll: if the chain tip changes or mempool changes
   significantly, miners polling `getblocktemplate` are unblocked
   with a fresh template.

The relevant code is in `zebra-rpc/src/methods/types/
get_block_template/`. `long_poll.rs` is the long-poll mechanism.

### Coinbase Math

Coinbase transactions carry:

- the block subsidy (from `zebra-consensus/src/block/subsidy/`).
- a height-based encoding in the scriptSig.
- the funding-stream payouts (Canopy through NU6).
- the NSM (Network Sustainability Mechanism) payouts (NU6+).
- the miner's payout (the residual).

The funding-stream addresses and percentages are in
[`zebra-chain/src/parameters/`](https://github.com/ZcashFoundation/zebra/tree/v4.4.1/zebra-chain/src/parameters). Any miss in the coinbase math
produces an invalid block.

### The Internal-miner Feature

Behind the `internal-miner` Cargo feature, Zebra can mine in-
process. Documented as testnet-only; not for production. Useful
for regtest and integration testing.

## The Wallet Ecosystem

Zebra is a node, not a wallet. The wallet world consumes Zebra's
APIs as follows.

### Lightwalletd

The `lightwalletd` daemon (ECC) sits in front of [`zebrad`](https://github.com/ZcashFoundation/zebra/tree/v4.4.1/zebrad) or
`zcashd` and exposes a gRPC interface tailored for light clients.
It is the original light-client server.

What lightwalletd needs from Zebra:

- JSON-RPC: blocks by height, raw transactions, mempool, send.
- a stable stream of new blocks as they arrive.

The integration tests behind the `lightwalletd-grpc-tests` Cargo
feature run a real `lightwalletd` against [`zebrad`](https://github.com/ZcashFoundation/zebra/tree/v4.4.1/zebrad).

### Zaino

`zingolabs/zaino` is the successor light-client server, written in
Rust, designed to consume Zebra's indexer gRPC directly. Aimed at
replacing or supplementing `lightwalletd` long-term.

What zaino needs from Zebra:

- the indexer gRPC (behind the `indexer` Cargo feature).
- block streams.
- spend-lookup-by-nullifier and other denormalized indexes.

### Zallet

`zcash/wallet` (Zallet) is the official ECC wallet effort
post-`zcashd`. Consumes Zebra's indexer and JSON-RPC.

### Other Wallets

YWallet, Nighthawk, Zashi, ZecWallet Lite (legacy), and others
consume one of: lightwalletd, zaino, or direct JSON-RPC to Zebra.

### The Indexer Surface

The indexer gRPC (Zebra crate `zebra-rpc/src/indexer/`) exposes:

- transparent address indexes.
- nullifier lookups.
- subtree roots.
- additional historical data not in standard JSON-RPC.

This is what wallet servers use to scan for incoming notes
efficiently. The exact methods evolve; consult the proto definitions
in the codebase.

## What This Means for the Validator Side

Even though Zebra is a validator, every of these consumers is a
constraint:

- mempool stability matters because wallets watch mempool.
- block template accuracy matters because miners' revenue depends
  on it.
- JSON-RPC compatibility with zcashd matters because every existing
  client expects zcashd-shaped responses.
- indexer correctness matters because wallets reconstruct user
  balances from it.

Bugs in any of these surfaces show up as wallet incidents long
before they show up as consensus incidents.

## See Also

- 09-threat-model.md (mempool DoS, mining-pool adversaries).
- [`book/src/dev/mempool-specification.md`](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/book/src/dev/mempool-specification.md).
- [`book/src/dev/diagrams/mempool-architecture.md`](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/book/src/dev/diagrams/mempool-architecture.md).
- [`book/src/user/mining.md`](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/book/src/user/mining.md) and [`book/src/user/mining-docker.md`](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/book/src/user/mining-docker.md).
- the `lightwalletd`, `zaino`, and `zallet` repositories.

## Spec Pointers

- [Zaino](https://github.com/zingolabs/zaino) for the lightwalletd-compatible indexer.
- [Zallet](https://github.com/zcash/wallet) for the reference wallet.
- `librustzcash` for the wallet-side cryptography.

## Exercises

1. Identify one feature that Zebra deliberately does not implement (wallet, block explorer, etc.) and find a closed PR that proposed it.
2. List the RPC methods Zebra exposes that Zaino consumes.
3. Find the Stratum or `getblocktemplate` entry point and explain in one sentence what it returns.
