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

Part 1, the structural map (read first):

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

Part 2, paranoia training (most important for principal-level
review):

- `09-threat-model.md`: privacy, consensus, cryptographic, and
  implementation adversaries Zebra defends against, and where in
  the code each defense lives.
- `10-incidents-and-audits.md`: a curated walkthrough of historical
  Zcash and Zebra incidents (2018 counterfeiting bug, ZIP-216, v5
  SIGHASH_SINGLE in v4.4.1, libzcash_script CVE).
- `11-cryptographic-correctness-practices.md`: the review discipline
  for constant-time concerns, canonical encoding, malleability,
  batch verification soundness, domain separation, randomness, and
  edge cases. Includes a reviewer checklist.

Part 3, protocol literacy:

- `12-protocol-history-and-governance.md`: the Zerocash to Sprout to
  Sapling to NU5 to NU6 timeline; the ECC / ZF / ZCG / ZODL
  ecosystem.
- `13-reading-the-spec.md`: how to use `protocol.pdf` efficiently.
  Notation, structure, normative-vs-non-normative, a worked
  example.
- `14-zips-and-ceremonies.md`: the ZIP lifecycle and template; the
  Sprout MPC, Sapling Powers of Tau, and why Orchard needs no
  setup.
- `15-nu7-and-future-work.md`: snapshot of in-flight protocol work
  (ZSAs, Crosslink, version bumps). Dates fast.

Part 4, role-specific depth:

- `16-formalisation-opportunities.md`: where your Lean / Mathlib
  background applies. Concrete targets in rough order of impact.
- `17-zcashd-parity-and-consensus-split.md`: how to stay
  consensus-equivalent with zcashd; how to bisect a divergence;
  the `comparison-interpreter` feature.
- `18-mempool-mining-and-wallet-ecosystem.md`: mempool rules,
  ZIP-401, the full `getblocktemplate` flow, and how lightwalletd,
  Zaino, and Zallet consume Zebra.

Part 5, operations and orientation:

- `19-observability-and-debugging.md`: tracing, metrics, tokio-
  console, flamegraph; how to bisect a consensus mismatch.
- `20-time-clocks-and-difficulty.md`: header timestamps, MTP,
  network-adjusted time, difficulty adjustment, time-warp; an
  underrated bug source.
- `21-glossary.md`: every Zcash and crypto term you should be able
  to use without hesitation.
- `22-first-90-days.md`: a concrete week-by-week plan for the
  first three months.

## suggested cadence

- week 0 (pre-start): files 01, 02. Spec sections 3, 4, 5.
- week 1: get mainnet syncing, read RFCs, files 05, 06, 07.
- week 2: file 03 and shadow-review three PRs.
- week 3: files 09, 10, 11 (paranoia training). Sapling and Orchard
  papers, Halo2 book. Pick a formalisation target (file 16).
- week 4: file 04, ZIP-244 / ZIP-216 deep dive. Trace a v5 sighash
  end to end.
- week 5: files 12, 13, 14 (protocol literacy). Read every
  recently-activated ZIP.
- week 6: files 15, 17 (parity and upcoming work). Compat tests.
- week 7: files 18, 19, 20 (operational depth). Run tokio-console
  and Prometheus locally.
- week 8: file 22 in detail. Plan your first contribution after
  Discord discussion.
- weeks 9 to 12: review external PRs, complete a piece of
  formalisation or audit work, co-author or lead-review a draft ZIP
  if one is in scope.

This is faster than the original three-files-per-week pace because
later files reinforce earlier ones; if you feel pressed, focus on
the part 2 (paranoia) and part 4 (role-specific) sections.

## a note on what zebra is not

Zebra is a validator node. It does not include a wallet, a block
explorer, or a mining pool. Wallet code lives in `zcash/wallet`
(Zallet) and `zingolabs/zaino`. Cryptographic primitives live in the
ECC crates: `librustzcash`, `orchard`, `sapling-crypto`,
`halo2_proofs`, `pasta_curves`, `jubjub`, `bls12_381`, `bellman`,
`reddsa`, `equihash`, `incrementalmerkletree`, etc. Zebra wires those
crates together and adds Zcash-aware verification, networking, and
state management.
