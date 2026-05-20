# 15. nu7 and future work

This file dates fast. Treat it as a snapshot of the in-flight
protocol work as of the file's writing date and verify each item on
the `zcash/zips` repo, the Zcash Foundation forum, and Discord
before relying on it.

## what is "nu7"

NU7 is the next-major Zcash network upgrade after NU6 (active on
mainnet since November 2024). NU6.1 is a smaller cleanup upgrade
that lands first or alongside.

Indicators of NU7 in this repo:

- `NetworkUpgrade::Nu7` variant in
  `zebra-chain/src/parameters/network_upgrade.rs`.
- the `cfg(zcash_unstable, values("nu7"))` lint-allowed config flag
  in `Cargo.toml`. Code gated on `nu7` is implementing-not-active.
- consensus branch IDs and activation heights pinned in
  `zebra-chain/src/parameters/network/constants.rs`. Activation
  heights for NU7 may be placeholders until governance ratifies.

## candidate features

Items widely discussed for inclusion in NU7 or a follow-up upgrade.
Each is a separate ZIP and may or may not actually land in NU7.

### zsas (zcash shielded assets)

A scheme for issuing and transferring user-defined assets in the
Orchard shielded pool. The shielded asset framework extends the
Action circuit to carry an asset identifier in addition to a value.
Multiple ZIPs in the ZSA family cover issuance, burn, and Action
extensions.

What to read:

- ZIP-227, ZIP-228, ZIP-229 (the ZSA family; check current numbering).
- the QEDIT prototype work (the original implementation).
- the `orchard-zsa` branch of the `orchard` crate.

### crosslink

A hybrid PoW-PoS construction proposed for adding finality to
Zcash without abandoning Equihash mining. The PoS layer ratifies
PoW blocks, providing fast finality on top of slow probabilistic
finality. Several ZIP drafts and a white-paper exist.

What to read:

- the Crosslink paper (Hopwood, et al.).
- forum discussions on PoS migration.

### transaction version bump (v6)

NU7 may introduce a v6 transaction format to carry ZSA support,
trailing metadata, or other features. Version bumps are
backward-incompatible at the consensus layer; expect
implementation effort in `zebra-chain/src/transaction/` and the
sighash code path.

### lightclient and mempool ZIPs

A handful of smaller ZIPs improving lightclient sync (block-data
shape, treestate availability) and mempool admission rules (anti-DoS
tweaks, fee tightening) are likely to land alongside NU7.

### post-quantum exploration

Not in NU7, but expect to see early discussion of post-quantum
migration paths.

## status surfaces to monitor

- `zcash/zips` PR feed: most authoritative for what is being
  written.
- Zcash Community Forum: for discussion and rationale.
- ZF and ECC engineering blogs: for implementation status updates.
- Zebra issue tracker, label `S-needs-design`: open architectural
  decisions in Zebra.
- ECC GitHub orgs (`zcash`, `electriccoinco`): implementation
  branches.
- the orchard, sapling-crypto, halo2 repos: for primitive-level
  changes.

## how nu7 will land in zebra

Based on prior upgrades, the rough sequence:

1. ZIPs reach "implementing" status.
2. ECC and ZF implementers agree on activation heights for testnet
   and mainnet.
3. testnet activation: first activated on testnet at an earlier
   height to flush out bugs.
4. interim Zebra releases gated on `cfg(zcash_unstable)`.
5. mainnet activation height is committed in a final release.
6. operators upgrade ahead of activation; everyone watches the
   activation block for divergence.

Your likely role: cryptographic review of the implementing ZIP,
contribution to the primitives crates (Orchard, sapling-crypto), and
integration into Zebra.

## things to do before NU7

- finish reading files 09 through 14 of this onboarding.
- read every recently-activated ZIP (NU5 and NU6 sets) cover to
  cover so you understand the lifecycle in practice.
- subscribe to the `zcash/zips` PR feed.
- ping ZF maintainers on Discord and introduce yourself; they will
  steer you to current priorities.
- attend the Arborist call (or whatever its current name is, the
  cross-implementation weekly) if invited; this is where compat
  conversations happen.

## see also

- 12-protocol-history-and-governance.md.
- 14-zips-and-ceremonies.md.
- `book/src/dev/ecc-updates.md` for the Zebra-side update process.
- `zebra-chain/src/parameters/network_upgrade.rs` for the variants
  currently declared.
