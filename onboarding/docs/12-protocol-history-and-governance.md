---
sidebar_position: 12
title: "Protocol History and Governance"
description: "Sprout, Sapling, Blossom, Heartwood, Canopy, NU5, NU6, NU7, and how upgrades are activated."
---

# Protocol History and Governance

## Why This Chapter Exists

The protocol is the protocol because of the history. Why does NU5 not unify Sapling and Orchard? Because Orchard was a deliberate clean break. Why does Sprout still exist? Because removing it would invalidate existing notes. You will read this chapter once and then need it.

You will hear names and dates as if they are common knowledge. They
are not. This file gives you the narrative.

## The Timeline at a Glance

- 2013: Zerocoin paper (Miers, Garman, Green, Rubin). A way to make
  Bitcoin transactions anonymous via accumulator-based mixing.
- 2014: Zerocash paper (Ben-Sasson, Chiesa, Garman, Green, Miers,
  Tromer, Virza). Uses zk-SNARKs (BCTV14) to give private payments
  with hidden values. IEEE S&P 2014.
- 2016 October: Zcash mainnet launches. The Zcash Sprout protocol is
  Zerocash with BCTV14 SNARKs over BN254 (Barreto-Naehrig 254-bit
  curve).
- 2018 June: Overwinter network upgrade. Replay protection,
  transaction expiry ([ZIP-203](https://zips.z.cash/zip-0203)), versioning groundwork.
- 2018 October: Sapling network upgrade. The big one. Replaces
  BCTV14 with Groth16 over BLS12-381. Introduces a new shielded
  pool with much smaller proofs (~200 bytes), faster generation
  (seconds on a phone, not minutes on a server), and hierarchical
  deterministic keys ([ZIP-32](https://zips.z.cash/zip-0032)). The Sapling MPC ceremony provided
  the trusted setup. Simultaneously fixes the BCTV14 soundness flaw
  silently.
- 2019 February: Public disclosure of the 2018 BCTV14 counterfeiting
  vulnerability.
- 2019 December: Blossom network upgrade. Halves block time from
  150s to 75s ([ZIP-208](https://zips.z.cash/zip-0208)).
- 2020 July: Heartwood network upgrade. Adds the chain history MMR
  ([ZIP-221](https://zips.z.cash/zip-0221)) and shielded coinbase support ([ZIP-213](https://zips.z.cash/zip-0213)).
- 2020 November: Canopy network upgrade. Founders' reward sunset,
  funding streams begin ([ZIP-207](https://zips.z.cash/zip-0207), [ZIP-214](https://zips.z.cash/zip-0214)). First halving (height
  1046400).
- 2022 May: NU5 network upgrade. Introduces the Orchard shielded
  pool with Halo2 proofs (no trusted setup, IPA over Pallas). New
  v5 transaction format ([ZIP-225](https://zips.z.cash/zip-0225), [ZIP-244](https://zips.z.cash/zip-0244) sighash). Canonical
  encoding enforcement ([ZIP-216](https://zips.z.cash/zip-0216)).
- 2024 November: NU6 network upgrade. Establishes the NSM (Network
  Sustainability Mechanism) for funding ([ZIP-1014](https://zips.z.cash/zip-1014), [ZIP-1015](https://zips.z.cash/zip-1015) family).
  Tightens consensus around funding streams.
- in progress: NU6.1 and NU7. See file 15.

## Why Each Upgrade Happened

The pattern is consistent: a research breakthrough, an engineering
need, or a governance decision drives the upgrade.

- Overwinter: defense in depth (replay, expiry) and groundwork.
- Sapling: research (Pinocchio -> Groth16; new commitment scheme;
  hierarchical keys) and the urgent need to patch BCTV14.
- Blossom: shorter block times for better UX.
- Heartwood: history commitments for stateless client work and
  cross-chain proofs.
- Canopy: governance (funding model transition).
- NU5: new shielded protocol (Orchard) without trusted setup,
  cleaner sighash, canonical encoding.
- NU6: funding mechanism update.

For every upgrade, the activation height is in
`zebra-chain/src/parameters/network/` constants and the variant is
in `network_upgrade.rs`.

## The Actors

### Electric Coin Company (ECC)

The original company that launched Zcash. Maintains `zcashd` (the
reference implementation, currently being wound down or transitioned),
`librustzcash` (the cryptographic primitives), `lightwalletd` (the
light-client server), and historically the wallet. Notable people
who do or have done foundational work: Sean Bowe (Halo2, Pasta,
bellman), Daira-Emma Hopwood (spec editor, protocol designer),
Jack Grigg / str4d (Sapling, zcash_primitives), Kris Nuttycombe
(librustzcash maintenance), Daira-Emma Hopwood and Madars Virza
(historical protocol design).

### Zcash Foundation (ZF)

Non-profit. Maintains Zebra, FROST (threshold signatures), and
infrastructure for the broader community. They drive the
diversification of the implementation set; Zebra exists so the Zcash
network is not single-implementation.

### Zcash Community Grants (ZCG)

Funds independent development from the developer fund. The
Zingo/Zaino/Zallet stack, plus academic and tooling grants, flow
through here.

### Zodl

Your new organization. As of this writing, ZODL's exact remit and
publicly stated mission may be evolving; verify the current scope on
the ZODL website and in recent forum posts before assuming any
specific responsibility split.

### Independent Contributors and External Researchers

Many ZIPs originate from individuals outside the three main orgs.
The ZIP process is open.

## How Decisions Get Made

There is no single body that ratifies protocol changes. The process
in practice:

1. someone (anyone) proposes an idea, usually as a forum post,
   followed by a draft ZIP submitted to `zcash/zips`.
2. the ZIP editors (Daira-Emma Hopwood and a handful of co-editors,
   list current at the time you read this) review for clarity and
   completeness.
3. community discussion happens on the forum, on Discord, and on the
   ZIP PR.
4. implementer feedback happens from ECC (`zcashd`), ZF (Zebra),
   wallet teams, and others.
5. the ZIP moves to "proposed" once reasonably stable.
6. if it is a consensus change, the implementers commit to including
   it in a specific network upgrade.
7. on activation, the ZIP becomes "active" and is part of the
   protocol going forward.

There is no on-chain vote. Adoption is by miner and node operator
choice; in practice the implementation set converges because
operators want compatibility.

## Governance Tensions Worth Knowing

- funding model: the funding-stream addresses, payout split, and
  sunset cadence have been the most-discussed governance topic for
  years. NU6 set the current configuration. Expect more discussion
  in NU7 and beyond.
- proof-of-work transition: Zcash is currently PoW (Equihash). PoS
  transition has been proposed multiple times. Crosslink is the
  current concrete proposal; see file 15.
- wallet UX vs node concerns: the validator side is conservative;
  the wallet side experiments. Working across the boundary requires
  patience.

## Who to Follow

- the `zcash/zips` PR feed.
- the Zcash Foundation Discord, especially `zebra-dev`,
  `protocol-and-data`, and the spec channel.
- the Zcash Community Forum.
- the ECC and ZF engineering blog feeds.
- the `librustzcash`, `orchard`, `sapling-crypto`, `halo2`
  GitHub activity.

## See Also

- 13-reading-the-spec.md (how to use the protocol spec).
- 14-zips-and-ceremonies.md (the ZIP process up close).
- 15-nu7-and-future-work.md (current upgrades).
- `book/src/dev/ecc-updates.md` (the Zebra-side process for
  updating ECC dependencies).

## Spec Pointers

- [ZIPs index](https://zips.z.cash/) for every network upgrade.
- [Zcash community forum](https://forum.zcashcommunity.com/) for governance discussion.

## Exercises

1. List the network upgrades in order and one sentence on what each delivered.
2. Find the activation height of NU5 on mainnet. Where is it encoded in [`zebra-chain`](https://github.com/ZcashFoundation/zebra/tree/v4.4.1/zebra-chain)?
3. Read one ZIP that has not yet activated and explain in three sentences what it changes.
