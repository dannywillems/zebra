---
sidebar_position: 9
title: "Threat Model"
description: "Adversary capabilities, formal goals, and where each defence lives in the workspace."
---

# Threat Model

## Why This Chapter Exists

If you do not know what attack a defence is protecting against, the defence will look like dead code to you and you will remove it. The chapter pairs adversary capabilities with the files and tests that defend against them.

The lens you should be reading the rest of the codebase with. Every
defensive choice in Zebra exists because of one of the adversaries
below. Memorize the categories.

## Privacy Adversaries

Zcash's primary product is privacy. The privacy adversary is anyone
trying to deanonymize users or link transactions.

### Transaction Graph Linkability

Even fully shielded transactions can leak information through:

- value: a tx that consumes one note of value V and outputs one note
  of value V (less fee) is a tracing oracle.
- timing: a tx broadcast immediately after another is more likely to
  be related.
- pool migration: a Sprout-to-Sapling or Sapling-to-Orchard migration
  may reveal the migrating user as a "power user".
- transparent edges: any transaction that touches the transparent
  pool is fully visible. Wallet UX that mixes shielded and
  transparent destroys privacy.

The validator node defends nothing about value or migration patterns
(those are wallet concerns), but it does control the timing and
peer-IP correlation: see below.

### Peer-ip and Metadata Adversary

An adversary running many P2P peers can correlate inbound
transactions to the IP that first announced them.

Defenses in Zebra:

- `isolated/`: anonymized peer connections for outbound user txs.
  Per [`zebra-network/src/lib.rs`](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-network/src/lib.rs), Tor support is currently disabled
  pending an `arti-client` dep update. The TCP anonymized path is
  available.
- inventory de-duplication: each tx is announced once per peer, not
  re-broadcast.
- gossip jitter: announcement delays.

What is not defended at the node level: passive AS-level observers,
correlated peer-set membership across runs. Wallet users who care
should run a node themselves or use Tor at the OS level.

### Viewing Key Disclosure and Scan Attacks

Out of Zebra's scope (the node has no keys), but worth knowing:
incoming viewing keys can be shared selectively, and the way wallets
scan for incoming notes is a recurring source of timing leaks (note
encryption trial-decryption time depends on hash function timing).
The note encryption library is `zcash_note_encryption`.

### Fingerprinting

Connection-time fingerprinting (user-agent string, supported
services, message order) can identify Zebra vs zcashd. Zebra
deliberately uses a `zcashd`-compatible user agent prefix to blend
in. See [`zebra-network/src/constants.rs`](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-network/src/constants.rs).

## Consensus Adversaries

Anyone trying to fork the chain, double-spend, or split the network.

### 51% / Majority Hashpower

Equihash GPU and ASIC mining means a sufficiently funded adversary
can attempt reorgs. Zebra's defenses:

- `MAX_BLOCK_REORG_HEIGHT = 100`. Anything more than 100 blocks
  below the tip is final and cannot be reorged.
- checkpoint table: until the latest checkpoint, only structural
  validity is checked, which is faster, but the checkpoint hash also
  serves as a hard upper bound on rewriting history below it.
- difficulty adjustment: per-block target rolling median based on
  `PoWMedianBlockSpan` (see [ZIP-208](https://zips.z.cash/zip-0208) and `zebra-chain/src/work/
  difficulty/`).

What this does not defend against: small reorgs within the
finalization window. Exchanges must wait for confirmations
accordingly.

### Eclipse and Partition Attacks

An adversary surrounding a node with malicious peers can hide blocks
or feed a private fork. Defenses:

- diverse seed peers and DNS seeds ([`zebra-network/src/config.rs`](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-network/src/config.rs)
  defaults).
- address book persistence: long-lived honest peers survive restarts.
- peer rotation under `peer_set/initialize/`.
- minimum peer count enforced before sync is declared healthy
  (`chain_sync_status`).

The relevant Bitcoin literature on Erebus (BGP-level eclipses) and
inbound-only eclipses applies here too.

### Time Warp

Attempts to bias the difficulty algorithm by stamping blocks with
distorted timestamps. Zcash's difficulty adjustment uses median time
past with bounded jitter (see [`zebra-state/src/service/check/`](https://github.com/ZcashFoundation/zebra/tree/v4.4.1/zebra-state/src/service/check) and
RFC 0006). See also file `20-time-clocks-and-difficulty.md` once
written.

### Fork After Checkpoint

If a checkpoint is wrong (bug or attacker-fed parameter), the chain
splits. Zebra's checkpoints are compiled in from
[`zebra-chain/src/parameters/checkpoint/`](https://github.com/ZcashFoundation/zebra/tree/v4.4.1/zebra-chain/src/parameters/checkpoint). Adding a new checkpoint
requires re-syncing and verifying the resulting hash; the
`zebra-checkpoints` tool in `zebra-utils/` is the canonical
generator.

## Cryptographic Adversaries

Anyone trying to forge proofs, signatures, or hashes.

### Signature Forgery and Malleability

- ECDSA: secp256k1 is well-studied; Zebra inherits Bitcoin defenses.
  Low-s normalization is enforced.
- Ed25519: Zebra uses `ed25519-zebra` with [ZIP-215](https://zips.z.cash/zip-0215) strict
  verification rules to eliminate signature malleability that was
  permitted in early Sprout-era specs.
- RedJubjub / RedPallas: Schnorr-style. The randomizer for spend
  authorization signatures uses fresh entropy from the prover.
  Re-randomization without re-knowledge of the secret should be
  infeasible.

### Proof Soundness

- Groth16 (Sapling, Sprout-on-Groth16): pairing-based, sound under
  the q-PKE assumption. Trusted setup is the open exposure (see
  file 10).
- Halo2 (Orchard): IPA-based, no trusted setup. The security
  argument is the soundness of the inner product argument plus the
  hardness of discrete log on Pallas.

Batch verification soundness: see file 11.

### Trusted Setup Compromise

If the Sapling MPC was compromised, an attacker can produce valid
Sapling spend / output proofs for false statements. The MPC was run
across many independent participants, with each participant's
contribution publicly verifiable. The defense is "at least one
honest participant"; if you do not believe that, you cannot trust
Sapling. Orchard does not have this exposure.

### Hash Collision / Preimage

BLAKE2 and SHA-2 are believed-secure. The interesting failure mode
is domain separation: every BLAKE2 call in Zcash uses a personal
string. Bugs in personal-string handling have caused security
incidents in past ZK systems.

## Implementation Adversaries

Anyone exploiting bugs in the node itself.

### Resource Exhaustion (DoS)

- malformed messages that trigger huge allocations: defended by
  `TrustedPreallocate` in [`zebra-chain/src/serialization/`](https://github.com/ZcashFoundation/zebra/tree/v4.4.1/zebra-chain/src/serialization). Every
  deserializer for attacker-controlled bytes must compute a hard
  upper bound on its allocation.
- request floods: defended by Tower backpressure, bounded channels,
  inbound queue overflow drops the connection.
- mempool flooding: defended by [ZIP-401](https://zips.z.cash/zip-0401) anti-DoS (size, fee, weight
  limits).
- proof verification timeouts: bound on per-block verification time.
- panic-on-DoS: clippy lints `unwrap_used`, `expect_used`, `panic`
  in critical paths.

### Panic and Crash

Zebra is consensus-critical. A panic is a chain-stall for the
operator. The lint policy and the AGENTS.md guidance "expect()
messages must explain why the invariant holds" are the discipline.

### Ffi Memory Issues

[`zebra-script`](https://github.com/ZcashFoundation/zebra/tree/v4.4.1/zebra-script) is the unsafe boundary. The wrapper is single-
crate so the rest of the workspace can keep `unsafe_code = "deny"`.
The `comparison-interpreter` feature runs a parallel Rust
implementation against the C++ one to catch divergence.

### Supply Chain

The dependency surface (see `Cargo.toml`) is large. [`deny.toml`](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/deny.toml)
configures `cargo-deny` for license, advisory, and source checks.
The `supply-chain/` directory in the repo root holds the
`cargo-vet` audit data.

### Timing Side Channels

The Rust crypto crates (`jubjub`, `pasta_curves`, `bls12_381`,
`ed25519-zebra`, `secp256k1`) make varying constant-time
guarantees. See file 11 for the review discipline.

## What This Means in Practice

When reviewing a PR, walk through each adversary category and ask:
does this change make any of them easier? When designing a new
feature, list the adversaries it must defend against before writing
code. This is the principal-level habit that separates a working
node from a robust one.

## See Also

- 10-incidents-and-audits.md (concrete past examples).
- 11-cryptographic-correctness-practices.md (the discipline).
- [`book/src/dev/rfcs/0003-inventory-tracking.md`](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/book/src/dev/rfcs/0003-inventory-tracking.md) (network defense
  detail).
- [`SECURITY.md`](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/SECURITY.md) at the repo root for responsible disclosure.

## Spec Pointers

- Published audits: [NCC Group 2020](https://research.nccgroup.com/wp-content/uploads/2020/07/NCC_Group_ZFND_Zebra_Halo2-2020-08-31_v1.0.pdf) and [Trail of Bits 2021](https://github.com/trailofbits/publications/).
- Zcash Foundation [security policy](https://zfnd.org/zcash-security/).

## Exercises

1. Pick one defence from the threat-model table and confirm the named test still exists. If it does not, that is a real regression: open an issue.
2. Add a row for a defence the table is missing and propose a test that would catch a regression.
3. For one row, explain in one sentence what an adversary would do if the defence were removed.
