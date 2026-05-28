---
sidebar_position: 0
title: "Zebra Onboarding"
description: "A personal, code-anchored course on the Zcash full node in Rust. Read this to start writing PRs, not to admire the architecture."
slug: /
---

# Zebra Onboarding

This is a personal onboarding course for [Zebra](https://github.com/ZcashFoundation/zebra), the Rust implementation of a Zcash full node maintained by the Zcash Foundation. The course is the kind of document that I, the reader, would have wanted when I first opened the repo, in the order I would have wanted to read it.

The audience is one person (me, the maintainer of this fork). It is written in the second person because that turned out to be the clearest voice, not because it is meant to teach anyone in particular.

<!-- prettier-ignore-start -->
:::warning Auto-generated. May be wrong.

This entire site was auto-generated using [Claude Code](https://claude.com/claude-code) by reading the Zebra source tree, the [Zcash protocol specification](https://zips.z.cash/protocol/protocol.pdf), and a stack of audit reports. Errors will have been introduced.

**The code in [ZcashFoundation/zebra](https://github.com/ZcashFoundation/zebra) is the law.** When this site disagrees with the source, the source wins.

**Authoritative references:**

- The source tree at [`ZcashFoundation/zebra`](https://github.com/ZcashFoundation/zebra), pinned in this course to tag [`v4.4.1`](https://github.com/ZcashFoundation/zebra/tree/v4.4.1).
- The [Zcash protocol specification (PDF)](https://zips.z.cash/protocol/protocol.pdf), latest version.
- The [ZIPs index](https://zips.z.cash/) for all protocol-level changes.
- The [Halo 2 book](https://zcash.github.io/halo2/) for the Orchard proving system.
- Published audits: [NCC Group 2020](https://research.nccgroup.com/wp-content/uploads/2020/07/NCC_Group_ZFND_Zebra_Halo2-2020-08-31_v1.0.pdf), [Trail of Bits 2021](https://github.com/trailofbits/publications/), and the [Zcash Foundation security index](https://zfnd.org/zcash-security/).

If you find a wrong claim, the easiest fix is to open an issue or PR on the [onboarding branch of the fork](https://github.com/dannywillems/zebra/tree/onboarding/onboarding). Use the "Edit this page" link at the bottom of each chapter to jump straight to the Markdown source.
:::
<!-- prettier-ignore-end -->

## Notation

The course reuses the same notation across chapters. Once is enough.

- $\mathbb{F}_p$: a prime field of order $p$. For Zcash, $p$ is the
  base field of either Jubjub (Sapling), Pallas (Orchard), or BLS12-381 (Groth16).
- $\mathbb{G}$: a cyclic group of prime order $q$, written additively.
- $[k]P$: scalar multiplication of point $P \in \mathbb{G}$ by scalar $k \in \mathbb{F}_q$.
- $H_\ell(\cdot)$: a hash with $\ell$-bit output (Blake2b for most KDF/PRF paths, Pedersen for fixed-domain commitments, Sinsemilla for the Orchard tree, Poseidon for in-circuit).
- $e(\cdot, \cdot)$: the BLS12-381 pairing $\mathbb{G}_1 \times \mathbb{G}_2 \to \mathbb{G}_T$, used by Groth16.
- $\mathsf{Com}(m; r)$: a commitment to message $m$ with randomness $r$. In Sapling, $\mathsf{Com}$ is a Pedersen commitment; in Orchard, the value commitment uses Pallas and the note commitment uses Sinsemilla.
- $\mathsf{Enc}_k$ / $\mathsf{Dec}_k$: symmetric encryption (ChaCha20-Poly1305 in Sapling note encryption).
- $\stackrel{\$}{\leftarrow}$: uniform random sampling.
- $a \mathbin{\\|} b$: byte-string concatenation.

## How to Read This Course

The chapters are ordered as the dependency graph of the codebase: you cannot understand chapter $n$ without chapters $1$ through $n-1$. The two load-bearing chapters are:

1. [Workspace, Dependency Graph, and Build](./01-architecture.md) - the crate map and the build commands you will run every day.
2. [Testing, Build, and CI](./07-testing-build-ci.md) - what every PR must pass locally before it goes anywhere.

The last chapter, [First 90 Days](./22-first-90-days.md), is a reading and contribution plan that converges on a real PR.

## Contribution Gate (Read Before Opening a PR)

The upstream `CLAUDE.md` enforces a contribution gate: **no PR before issue discussion with a Zcash Foundation team member**. The detail is in [chapter 22](./22-first-90-days.md) and in the upstream [`CLAUDE.md`](https://github.com/ZcashFoundation/zebra/blob/main/CLAUDE.md). Skipping it gets the PR closed regardless of how good the code is.

## License Note

This course quotes Zebra source code under its MIT or Apache-2.0 license. The course prose itself is personal notes and carries no separate license: if you want to reuse it, ask first.
