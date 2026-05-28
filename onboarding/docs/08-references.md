---
sidebar_position: 8
title: "External References and Specs"
description: "Where to find the Zcash protocol spec, ZIPs, Halo 2 documentation, and primary audit reports."
---

# External References and Specs

## Why This Chapter Exists

Bookmark this page. Every other chapter cites it. The course's claim to authority is only as strong as these references, so they are listed together so you can audit them in one place.

Primary documents to read alongside the code. Items are grouped by
which onboarding file they support.

## General

- Zcash Protocol Specification (NU6 version): https://zips.z.cash/
  protocol/protocol.pdf. Print sections 3 to 7 and 8.
- ZIP index: https://zips.z.cash/. Read the activated ZIPs at
  minimum.
- Zebra Book: https://zebra.zfnd.org/. The same content as
  `book/src/`.
- Zebra internal API docs (rustdoc on the main branch):
  https://zebra.zfnd.org/internal.
- Zebra rfcs: `book/src/dev/rfcs/` 0001 through 0012.

## File 01 (Architecture)

- `Cargo.toml` workspace root.
- `book/src/dev/overview.md`.
- `book/src/dev/diagrams/zebra-network.md` and
  `book/src/dev/diagrams/mempool-architecture.md`.

## File 02 (zebra-chain)

- Sapling spec: https://github.com/zcash/zips/blob/main/protocol/
  sapling.pdf (this is the source of the Sapling design; the unified
  spec subsumes it).
- ZIP-32 (HD wallets for shielded), ZIP-203 (transaction expiry),
  ZIP-216 (jubjub canonical encoding), ZIP-221 (history tree),
  ZIP-225 (v5 transaction format), ZIP-239 (block sync over
  bitcoin-style protocol), ZIP-244 (NU5 txid and sighash).
- The `librustzcash` repo: https://github.com/zcash/librustzcash.

## File 03 (Cryptography)

- Sapling paper: Hopwood, Bowe, Hornby, Wilcox-O'Hearn, 2016.
- Orchard book: https://zcash.github.io/orchard/.
- Halo2 book: https://zcash.github.io/halo2/.
- BLS12-381 paper and the `bls12_381` Rust crate.
- Jubjub paper and the `jubjub` Rust crate.
- Pasta curves (Pallas + Vesta): https://github.com/zcash/
  pasta_curves.
- Sinsemilla: Orchard book chapter on the hash.
- Pedersen: Sapling spec section 5.4.7.
- BLAKE2 RFC 7693. Watch the personal string usage everywhere.
- RedJubjub and RedDSA: ZIP-200 plus the `redjubjub` and `reddsa`
  crates.
- Ed25519 ZIP-215 strict verification: see `ed25519-zebra` README.
- Equihash: Biryukov and Khovratovich, "Equihash: Asymmetric Proof-
  of-Work Based on the Generalized Birthday Problem".

## File 04 (Consensus and State)

- ZIP-244 for sighash and authdigest.
- ZIP-216 for jubjub canonical encoding (relevant to verifier
  correctness).
- Zebra RFC 0002 Parallel Verification.
- Zebra RFC 0004 Asynchronous Script Verification.
- Zebra RFC 0005 State Updates.
- Zebra RFC 0006 Contextual Difficulty Validation.
- Zebra RFC 0007 Tree States.
- Zebra RFC 0010 V5 Transaction.
- Zebra RFC 0012 Value Pools.
- Bitcoin developer reference for context on the block, header, and
  Merkle conventions Zcash inherits.

## File 05 (Network and Rpc)

- Bitcoin P2P protocol docs: https://en.bitcoin.it/wiki/Protocol_
  documentation. Used as the base; Zcash overlays its own messages
  and version bits.
- ZIP-239 for Zcash-specific block sync semantics.
- Lightwalletd protocol: https://github.com/zcash/lightwalletd.
- zcashd JSON-RPC reference (zcashd source `src/rpc/`).
- Zebra mempool spec: `book/src/dev/mempool-specification.md`.

## File 06 (zebrad and Tower)

- Tower docs: https://docs.rs/tower.
- Tokio docs, in particular the `sync::watch` and `sync::mpsc`
  modules.
- Abscissa: https://github.com/iqlusioninc/abscissa.
- Zebra RFC 0011 Async Rust in Zebra.
- Zebra RFC 0001 Pipelinable Block Lookup.

## File 07 (Testing, Build, Ci)

- nextest book: https://nexte.st/.
- proptest book: https://altsysrq.github.io/proptest-book/.
- `.github/workflows/README.md`.
- `book/src/dev/continuous-integration.md` and
  `book/src/dev/continuous-delivery.md`.

## People and Channels

- Zcash Foundation Discord: `https://discord.com/invite/aRgNRVwsM8`,
  channel `zebra-support`.
- Issue tracker:
  https://github.com/ZcashFoundation/zebra/issues.
- ZIP discussions live as PRs on https://github.com/zcash/zips.
- ECC engineering blog: https://electriccoin.co/blog/.
- Zcash Forum: https://forum.zcashcommunity.com/.

## A Final Note

The Zcash spec is the authoritative source. Where the spec and the
code disagree, the spec wins unless the disagreement is itself a
ratified consensus rule (in which case the spec is updated). When in
doubt, raise the question on Discord or as a `zips` PR. The Zebra
maintainers are responsive and the spec authors are accessible.

## Spec Pointers

All references in this chapter are themselves spec pointers. See the body.

## Exercises

1. Open the Zcash protocol spec PDF and find the section that defines the value commitment. Cite the section number.
2. Identify one ZIP that is referenced by Zebra source code today and locate the file that implements it.
3. Find one piece of upstream documentation in `book/` that disagrees with the source. Note it for a future PR.
