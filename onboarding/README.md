# zebra onboarding: a graduate course

A self-paced reading curriculum for a principal cryptography engineer
joining Zcash work full time, focused on the Zebra full node
(https://github.com/ZcashFoundation/zebra).

The goal is not to memorize the codebase but to build the right mental
model so the source becomes searchable, and so cryptographic design
choices become legible in context.

## how to use this directory

Read the files in order. Each file links to specific paths and line
numbers under the working tree (`/Users/soc/codes/zcash/zebra/`). Open
the referenced files alongside this guide so that every claim has a
concrete referent.

The Zcash protocol specification and the relevant ZIPs are essential
companions to this code. The references file at the end lists what to
read alongside each part.

## files in this onboarding

- `01-architecture.md`: workspace layout, the 12-crate dependency
  graph, build system, toolchain, feature flags.
- `02-zebra-chain.md`: the sync-only data model crate. Blocks,
  transactions, transparent/Sprout/Sapling/Orchard pool types, network
  upgrades, value pools, work and difficulty.
- `03-cryptography.md`: the cryptography stack as it appears in
  Zebra. Hash functions, signature schemes, commitment schemes, note
  encryption, Groth16 and Halo2 verification, batching. Where each
  primitive lives (Zebra vs librustzcash vs ECC crates) and how they
  connect.
- `04-consensus-and-state.md`: `zebra-consensus` (structural and
  semantic verification, checkpoint vs full path, verifier routers)
  and `zebra-state` (finalized RocksDB store, non-finalized fork
  trees, read/write split, contextual verification).
- `05-network-and-rpc.md`: `zebra-network` (Tower-based P2P,
  PeerSet, Connection state machine, address book, inventory
  registry, Bitcoin-derived wire protocol) and `zebra-rpc` (JSON-RPC
  surface, indexer gRPC, mempool/block-template flow).
- `06-zebrad-and-tower.md`: the binary, the components (sync,
  inbound, mempool, miner, metrics, tracing), and the two Tower
  middlewares (`tower-batch-control`, `tower-fallback`) that you must
  understand to read any verifier or service.
- `07-testing-build-ci.md`: how tests are organized, property
  testing, nextest profiles, integration sync tests, CI workflows,
  Docker images, release process.
- `08-references.md`: protocol spec sections, ZIPs, papers, and
  external crates worth reading in detail.

## suggested cadence

- week 1: files 01 and 02. Spec sections 3, 4, 5. ZIP-200 and the
  network upgrade ZIPs.
- week 2: file 03. Sapling and Orchard papers, halo2 book.
- week 3: file 04. ZIP-244, ZIP-216, the RFCs under `book/src/dev/
  rfcs/` (especially 0002 Parallel Verification, 0004 Async Script
  Verification, 0005 State Updates, 0006 Contextual Difficulty, 0007
  Tree States, 0010 V5 Transaction).
- week 4: file 05. Bitcoin P2P message reference plus the protocol
  spec's network section. Read the JSON-RPC method list in
  `zebra-rpc/src/methods/types/`.
- week 5: file 06 and 07. Run `zebrad` locally on testnet, watch the
  metrics endpoint, follow a block from inbound to commit using
  tracing.
- week 6: pick one open issue tagged `S-needs-design`, write up an
  approach against the actual code. Discuss with the Zebra team on
  Discord before opening anything.

## a note on what zebra is not

Zebra is a validator node. It does not include a wallet, a block
explorer, or a mining pool. Wallet code lives in `zcash/wallet`
(Zallet) and `zingolabs/zaino`. Cryptographic primitives live in the
ECC crates: `librustzcash`, `orchard`, `sapling-crypto`,
`halo2_proofs`, `pasta_curves`, `jubjub`, `bls12_381`, `bellman`,
`reddsa`, `equihash`, `incrementalmerkletree`, etc. Zebra wires those
crates together and adds Zcash-aware verification, networking, and
state management.
