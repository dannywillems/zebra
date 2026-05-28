---
sidebar_position: 14
title: "ZIPs and Trusted Setup Ceremonies"
description: "The ZIP process, the Sapling MPC and Powers of Tau ceremonies, and what their outputs mean for Zebra."
---

# ZIPs and Trusted Setup Ceremonies

## Why This Chapter Exists

The Groth16 trusted setup is a single point of failure that every Sapling note still depends on. The MPC ceremonies are what mitigate it. If you do not understand the threat model of the ceremony, you cannot reason about Sapling soundness.

## The Zip Process

ZIP stands for Zcash Improvement Proposal. The process is modeled on
Bitcoin's BIPs and Ethereum's EIPs.

### Lifecycle States

A ZIP moves through these states in the `zcash/zips` repo:

- **draft**: proposed, in active editing. PR is open.
- **proposed**: stable enough for review; awaiting implementer or
  community sign-off.
- **implementing**: implementers (ECC, ZF, wallet teams) are
  committing it to a specific upgrade.
- **active**: deployed on mainnet at a known activation height.
- **historic**: superseded by a later ZIP or rendered obsolete.
- **withdrawn** or **rejected**: not adopted.
- **replaced**: a later ZIP supersedes this one.

The status is in the YAML front matter at the top of every ZIP
file. Always check the status before relying on a ZIP as authority.

### The Template

Every ZIP has a fixed structure:

- header: ZIP number, title, owners, status, category, dependencies,
  activation upgrade.
- terminology: special-case definitions for this ZIP.
- abstract: a paragraph of plain-English summary.
- motivation: why this is needed.
- requirements: what the change must achieve.
- non-requirements: what it explicitly does not promise.
- specification: the normative text.
- rationale: why the specific design was chosen.
- security and privacy considerations: explicit threat-model
  analysis.
- backward compatibility: migration concerns.
- reference implementation: links to PRs in `zcashd`,
  `librustzcash`, Zebra, wallets.
- test vectors: required for any spec-touching ZIP.
- references.

A ZIP without test vectors will not be accepted as implementing.

### Writing a Zip: Practical Tips

- start with a forum post or Discord conversation, not a PR. The
  community discussion uncovers requirements you would otherwise
  miss.
- write the abstract last. It is the hardest part because it has
  to be both correct and accessible.
- get the test vectors generated and reviewed by at least two
  implementations before declaring "implementing".
- expect three to five rounds of review with the editors. The
  editors are pedantic by design; this is what keeps the
  specification consistent across years.

### The Editors

ZIP editors as of the time this file was written include Daira-Emma
Hopwood, with several co-editors. Editors do not approve the
*content* of a ZIP; they approve its *form* (does it follow the
template, is the language unambiguous, are the references correct).

## Ceremonies and Trusted Setups

### The Sprout MPC

The original 2016 Zcash launch parameters came from a six-party MPC
for the BCTV14 setup. Public ceremony with reproducible setup
artifacts. Documented in the original Zcash blog posts; the
participants' contributions are publicly verifiable.

The BCTV14 parameters were *later replaced* (when the bug was
discovered) by Groth16 parameters for the Sprout-on-Groth16
re-proofing path. The Sprout-on-Groth16 setup also came from an
MPC.

### The Sapling MPC

Sapling needed a much larger parameter set (the Sapling Spend and
Output circuits). The ceremony ran in two phases:

1. **Powers of Tau**: a multi-participant ceremony that produced a
   universal SRS usable by any zk-SNARK over the same curve. Many
   participants over an extended period. Each participant published
   their contribution and proof of correct participation.
2. **Sapling-specific phase**: starting from Powers of Tau, derive
   the Sapling-circuit-specific proving and verifying keys via a
   second MPC.

The keys are now in `zcash_proofs`. If you ever need to verify
your local Sapling parameters, the canonical hashes are in the
spec.

The security argument: at least one participant in each phase was
honest *and* deleted their toxic waste. If true, the parameters are
sound. If false, the prover can produce false proofs.

### Orchard: No Trusted Setup

Halo2's IPA scheme has no trusted setup. The public parameters are
the Pallas curve and a hash-to-curve construction; no MPC was
needed. This was a major design goal for NU5.

Implication: any future shielded protocol added to Zcash should
prefer a no-setup scheme unless the trade-off is clearly worth it.

### Post-quantum Considerations

None of the schemes in active Zcash use are post-quantum secure.
The discrete log on Pallas is broken by a sufficiently large quantum
computer (in the future). Migration plans are in early discussion;
candidate post-quantum SNARK frameworks include STARKs and various
lattice-based constructions. This is a likely subject of future
ZIPs.

## How Zips and the Spec Relate

The spec is the *normative* document. A ZIP is the change record.
When a ZIP activates, its specification text is integrated into the
spec. The ZIP itself remains as historical documentation, but the
spec is the source of truth from that point on.

Reading order for a current change: read the spec section first,
then the ZIP for context.

## See Also

- 12-protocol-history-and-governance.md.
- 13-reading-the-spec.md.
- the `zcash/zips` repository.
- ECC's blog posts on the Sapling MPC ceremony.
- the Powers of Tau write-up by Sean Bowe.

## Spec Pointers

- Powers of Tau and Sapling MPC writeups under [zcash/mpc](https://github.com/zcash/mpc).
- [ZIP 251](https://zips.z.cash/zip-0251) and the NU5 ceremony notes.

## Exercises

1. Identify the file in Zebra that loads the Sapling trusted-setup parameters. Where is the hash of those parameters checked?
2. Read the Sapling MPC writeup and identify the assumption that fails if every participant colludes.
3. Explain in three sentences why Halo 2 (Orchard) does not need a trusted setup.
