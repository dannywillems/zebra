---
sidebar_position: 21
title: "Glossary"
description: "Domain abbreviations and protocol terms used throughout the course, with pointers to the file where each is defined."
---

# Glossary

## Why This Chapter Exists

A flat list of the domain abbreviations the codebase uses internally. Every entry should link to the file where the term is defined.

Every term you will hear used as common knowledge in Zcash work,
with a crisp definition and a pointer to where it lives. If you
cannot use any of these terms without a moment's hesitation, you
are not yet ready.

Alphabetical.

## A

**Action**: an Orchard transfer record (NU5+). A single Action
spends one input note and produces one output note, with associated
nullifier, commitment, and proof. The Orchard Action circuit
covers both spend and output in one proof. Parallels the Sapling
Spend + Output pair.

**Anchor**: a root of the note commitment tree at some prior block
height, against which a spend's authentication path is checked.
Each shielded pool has its own tree and its own anchors. The spend
must show a path to an anchor that the chain has previously seen.

**AuthDigest**: the [ZIP-244](https://zips.z.cash/zip-0244) authorization digest. Commits to the
authorizing data (signatures, proofs) of a v5+ transaction
separately from the txid. Allows recomputing the txid without
seeing the authorizations.

## B

**BCTV14**: the original Sprout proving system (Ben-Sasson, Chiesa,
Tromer, Virza 2014). Replaced by Groth16 at Sapling activation due
to a soundness flaw.

**Bellman**: the bellman crate, original Groth16 prover/verifier
implementation in Rust used by Sapling.

**Binding signature**: a RedJubjub or RedPallas signature over the
sum of value commitments minus the value balance, proving the
prover knew the sum of value commitment randomizers and therefore
that the transaction balances.

**BLAKE2b**: the 512-bit BLAKE2 hash variant, widely used for
txids, sighashes, and history-tree hashes (with truncation to 256
bits and a personal string).

**BLAKE2s**: the 256-bit BLAKE2 variant, used inside Equihash and
some key derivations.

**BLS12-381**: a pairing-friendly elliptic curve used by Sapling
Groth16.

## C

**Canonical encoding**: the unique valid byte representation of a
field element, group element, or other consensus object. [ZIP-216](https://zips.z.cash/zip-0216)
mandates canonical Jubjub encoding from NU5.

**Coinbase transaction**: the first transaction in every block.
Has no transparent inputs other than the block-height-encoding
scriptSig; produces the block subsidy plus fees, possibly with
shielded outputs (post-Heartwood [ZIP-213](https://zips.z.cash/zip-0213)).

**Consensus branch ID**: a u32 identifying the active network
upgrade. Mixed into sighash personal strings ([ZIP-244](https://zips.z.cash/zip-0244)). Each NU
has one.

**Commitment**: a binding, hiding commitment to a value. In Zcash:
Pedersen for Sapling, Sinsemilla for Orchard, SHA-256-based for
Sprout.

## D

**Diversifier**: an 11-byte (Sapling) or 11-byte (Orchard)
parameter that derives a unique payment address from a shielded
key pair. Enables wallet-side address rotation without key
rotation.

## E

**ECC**: Electric Coin Company. Founders and original developers of
Zcash.

**Equihash**: the proof-of-work algorithm Zcash uses. Parameters
(n=200, k=9), solution size 1344 bytes.

**Expiry height**: a transaction field defining the highest block
height at which the transaction is valid. [ZIP-203](https://zips.z.cash/zip-0203).

## F

**FF1**: format-preserving encryption based on AES. Used in
diversifier derivation.

**FR**: Founders' Reward. Pre-Canopy block reward share going to
founders. Replaced by funding streams at Canopy.

**Funding stream**: a Canopy-era block reward share routed to a
specific address. Multiple parallel streams (ECC, ZF, ZCG)
configured by network parameters.

**FVK / FullViewingKey**: a shielded key that allows viewing all
incoming and outgoing notes, plus their values, without the ability
to spend.

## G

**Genesis block**: the first block in the chain. Has special
status in the consensus rules (no PoW check or different check, no
predecessor MTP, etc.). Mainnet genesis hash is in
[`zebra-chain/src/block/genesis.rs`](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-chain/src/block/genesis.rs).

**Groth16**: a pairing-based zk-SNARK with constant-size proofs.
Used by Sapling Spend, Sapling Output, and Sprout-on-Groth16
proofs.

## H

**Halo2**: an IPA-based proving system used by Orchard. No trusted
setup. Implemented in `halo2_proofs`.

**Heartwood**: the July 2020 network upgrade. Added the chain
history MMR ([ZIP-221](https://zips.z.cash/zip-0221)) and shielded coinbase support ([ZIP-213](https://zips.z.cash/zip-0213)).

**History tree**: the chain-history MMR introduced at Heartwood. A
Merkle Mountain Range over block-level commitments. Root is
committed in each block header.

## I

**Incremental witness**: an authentication path through the note
commitment tree that can be updated when new commitments are
appended without re-hashing the whole tree.

**IPA**: Inner Product Argument. The polynomial commitment scheme
underlying Halo2. Provides a no-trusted-setup proving system.

**IVK / IncomingViewingKey**: a shielded key derived from FVK,
allows scanning for incoming notes only.

## J

**JoinSplit**: a Sprout transfer description. Includes the ZK proof,
two input note nullifiers, two output note commitments, and a
publicly-visible value transfer to/from the transparent pool.

**Jubjub**: the elliptic curve used by Sapling. Edwards form on a
prime-order subgroup of BLS12-381.

## L

**Lightwalletd**: the original ECC light-client server. Sits in
front of `zcashd` or [`zebrad`](https://github.com/ZcashFoundation/zebra/tree/v4.4.1/zebrad) and exposes a gRPC interface for
light clients.

## M

**Mainnet**: the production Zcash network. Genesis at block 0
(October 2016).

**Memo**: a 512-byte field in a shielded note used for encrypted
recipient-to-sender messages. Padded with zeros if unused.

**Mempool**: the validator-side queue of unconfirmed but valid
transactions. Subject to [ZIP-401](https://zips.z.cash/zip-0401) anti-DoS rules.

**MMR**: Merkle Mountain Range. The tree shape used by the chain
history tree ([ZIP-221](https://zips.z.cash/zip-0221)).

**MTP**: Median Time Past. The median of the previous 11 block
timestamps. Used for difficulty adjustment and lock-time checks.

## N

**Note**: a shielded coin record (value + recipient + randomness).
The "note plaintext" is the unencrypted content; the "note
commitment" is the hash committing to it; the "note ciphertext" is
the encrypted form.

**NSM**: Network Sustainability Mechanism. The post-NU6 funding
mechanism, replacing the original funding streams.

**nu5 / nu6 / nu7**: shorthand for the network upgrades. NU5 May
2022 (Orchard), NU6 November 2024 (NSM), NU7 forthcoming.

**Nullifier**: a deterministic, key-binding hash of a note that is
revealed when the note is spent. The nullifier set tracks all
spent notes; a transaction is contextually valid only if its
nullifiers are unrevealed.

## O

**Orchard**: the NU5+ shielded pool using Halo2 over Pallas. The
Action circuit unifies spend and output.

**Overwinter**: the June 2018 network upgrade. Added replay
protection, expiry, and versioning groundwork.

**OVK / OutgoingViewingKey**: a shielded key that allows recovering
information about one's own outgoing transactions.

## P

**Pallas**: the curve used by Orchard. Half of the Pasta cycle.

**Pasta**: the pair of curves (Pallas and Vesta) designed for
Halo2's recursive composition.

**Pedersen hash**: the hash function used by Sapling for note
commitments and the Sapling commitment tree.

**P2PKH / P2SH**: Bitcoin-style transparent address types. P2PKH
is pay-to-public-key-hash; P2SH is pay-to-script-hash.

**PoWAveragingWindow**: 17 blocks. The window over which difficulty
is averaged.

**PoWMedianBlockSpan**: 11 blocks. The MTP window.

**PoWTargetSpacing**: target seconds per block. 150 pre-Blossom,
75 post-Blossom.

**Powers of Tau**: a universal SRS produced by a multi-participant
MPC ceremony. Sapling's trusted setup was built on top of this.

## R

**RedDSA**: a Schnorr-like signature scheme used in Zcash. RedJubjub
is RedDSA over Jubjub; RedPallas is RedDSA over Pallas.

**Regtest**: a private testnet mode for local testing. Documented
at `book/src/user/regtest.md`.

## S

**Sapling**: the October 2018 network upgrade and the shielded pool
it introduced. Uses Groth16 over BLS12-381 with Jubjub for ECC.

**Sapling MPC**: the multi-party ceremony that produced Sapling's
trusted setup.

**Sapling note encryption**: the AEAD-based scheme that encrypts
note plaintexts to recipients. Reused with parameter variations
for Orchard.

**Sighash**: the transaction digest signed by a transparent or
shielded spend authorization. v4 uses [ZIP-243](https://zips.z.cash/zip-0243) sighash; v5+ uses
[ZIP-244](https://zips.z.cash/zip-0244).

**Sigops**: signature-verification operations counted for block-
size cost. Both inputs and outputs contribute; P2SH redeem scripts
contribute their own count.

**Sinsemilla**: the hash function used by Orchard for note
commitments and the Orchard commitment tree.

**SLIP-0044**: the registry of coin types for BIP-32 derivation.
Zcash mainnet uses 133.

**SLIP-0010**: defines the derivation of shielded keys for some
wallets.

**Sprout**: the original Zcash shielded pool. Uses BCTV14, later
Groth16, JoinSplits, and the Sprout note commitment tree (SHA-256
based).

**SRS**: Structured Reference String. The trusted-setup output of
an MPC. Sapling has one; Orchard does not need one.

## T

**Testnet**: the public test Zcash network. Activates upgrades
before mainnet.

**Treestate**: the state of all four note commitment trees and the
nullifier set at a specific block height.

**Transparent pool**: the Bitcoin-style transparent transactions
and their balances. The "T" pool in TZE notation.

## U

**UFVK / UnifiedFullViewingKey**: a viewing key combining FVKs from
multiple shielded pools (Sapling, Orchard, transparent) into one
encodable string. [ZIP-316](https://zips.z.cash/zip-0316).

**UIVK / UnifiedIncomingViewingKey**: the unified version of IVK.

**Unified address**: a payment address that contains components
from multiple pools, allowing wallets to choose the best pool for
incoming funds. [ZIP-316](https://zips.z.cash/zip-0316).

**UTXO**: unspent transaction output. The Bitcoin-style transparent
spendable record.

## V

**Value balance**: the per-pool net flow into the transparent pool
in a transaction. A positive value means the transparent pool gains
from the shielded pool. Each pool has its own balance.

**Value commitment**: a Pedersen (Sapling) or Sinsemilla (Orchard)
commitment to a note's value. Used in the binding signature.

**Value pool**: the total balance held in a specific shielded pool.
Tracked by the state service.

**v5 transaction**: NU5-era transaction format. [ZIP-225](https://zips.z.cash/zip-0225).

## W

**Witness**: the secret input to a circuit. Distinct from the
"incremental witness" which is the authentication path; context
disambiguates.

## Z

**Zaino**: the Rust light-client server from zingolabs, intended as
the successor to lightwalletd.

**Zallet**: ECC's wallet effort to succeed the zcashd wallet.

**ZCG**: Zcash Community Grants. The grant-making body for
non-ECC, non-ZF Zcash development.

**Zcash Foundation (ZF)**: non-profit. Maintains Zebra and other
infrastructure.

**zcashd**: the original Zcash node, ECC's C++ implementation.

**ZIP**: Zcash Improvement Proposal.

**zk-SNARK**: succinct non-interactive argument of knowledge. The
proof system class to which Groth16 and Halo2 belong.

**ZSA**: Zcash Shielded Assets. The proposal to support user-defined
assets in the Orchard pool. Likely in NU7.

## See Also

- the Zcash Protocol Specification glossary (section 2).
- the ZIP repository, README.
- `book/src/user/` for user-facing terminology.

## Spec Pointers

The body of this chapter is itself a reference; every term should point at the source that defines it.

## Exercises

1. Pick three terms in this glossary and confirm the linked file actually defines them.
2. Find one term used in the codebase that is missing from this glossary. Add it.
3. Identify one term in the protocol spec that is *not* used in Zebra source. Decide whether to include it.
