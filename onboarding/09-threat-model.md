# 09. threat model

The lens you should be reading the rest of the codebase with. Every
defensive choice in Zebra exists because of one of the adversaries
below. Memorize the categories.

## privacy adversaries

Zcash's primary product is privacy. The privacy adversary is anyone
trying to deanonymize users or link transactions.

### transaction graph linkability

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

### peer-IP and metadata adversary

An adversary running many P2P peers can correlate inbound
transactions to the IP that first announced them.

Defenses in Zebra:

- `isolated/`: anonymized peer connections for outbound user txs.
  Per `zebra-network/src/lib.rs`, Tor support is currently disabled
  pending an `arti-client` dep update. The TCP anonymized path is
  available.
- inventory de-duplication: each tx is announced once per peer, not
  re-broadcast.
- gossip jitter: announcement delays.

What is not defended at the node level: passive AS-level observers,
correlated peer-set membership across runs. Wallet users who care
should run a node themselves or use Tor at the OS level.

### viewing key disclosure and scan attacks

Out of Zebra's scope (the node has no keys), but worth knowing:
incoming viewing keys can be shared selectively, and the way wallets
scan for incoming notes is a recurring source of timing leaks (note
encryption trial-decryption time depends on hash function timing).
The note encryption library is `zcash_note_encryption`.

### fingerprinting

Connection-time fingerprinting (user-agent string, supported
services, message order) can identify Zebra vs zcashd. Zebra
deliberately uses a `zcashd`-compatible user agent prefix to blend
in. See `zebra-network/src/constants.rs`.

## consensus adversaries

Anyone trying to fork the chain, double-spend, or split the network.

### 51% / majority hashpower

Equihash GPU and ASIC mining means a sufficiently funded adversary
can attempt reorgs. Zebra's defenses:

- `MAX_BLOCK_REORG_HEIGHT = 100`. Anything more than 100 blocks
  below the tip is final and cannot be reorged.
- checkpoint table: until the latest checkpoint, only structural
  validity is checked, which is faster, but the checkpoint hash also
  serves as a hard upper bound on rewriting history below it.
- difficulty adjustment: per-block target rolling median based on
  `PoWMedianBlockSpan` (see ZIP-208 and `zebra-chain/src/work/
  difficulty/`).

What this does not defend against: small reorgs within the
finalization window. Exchanges must wait for confirmations
accordingly.

### eclipse and partition attacks

An adversary surrounding a node with malicious peers can hide blocks
or feed a private fork. Defenses:

- diverse seed peers and DNS seeds (`zebra-network/src/config.rs`
  defaults).
- address book persistence: long-lived honest peers survive restarts.
- peer rotation under `peer_set/initialize/`.
- minimum peer count enforced before sync is declared healthy
  (`chain_sync_status`).

The relevant Bitcoin literature on Erebus (BGP-level eclipses) and
inbound-only eclipses applies here too.

### time warp

Attempts to bias the difficulty algorithm by stamping blocks with
distorted timestamps. Zcash's difficulty adjustment uses median time
past with bounded jitter (see `zebra-state/src/service/check/` and
RFC 0006). See also file `20-time-clocks-and-difficulty.md` once
written.

### fork after checkpoint

If a checkpoint is wrong (bug or attacker-fed parameter), the chain
splits. Zebra's checkpoints are compiled in from
`zebra-chain/src/parameters/checkpoint/`. Adding a new checkpoint
requires re-syncing and verifying the resulting hash; the
`zebra-checkpoints` tool in `zebra-utils/` is the canonical
generator.

## cryptographic adversaries

Anyone trying to forge proofs, signatures, or hashes.

### signature forgery and malleability

- ECDSA: secp256k1 is well-studied; Zebra inherits Bitcoin defenses.
  Low-s normalization is enforced.
- Ed25519: Zebra uses `ed25519-zebra` with ZIP-215 strict
  verification rules to eliminate signature malleability that was
  permitted in early Sprout-era specs.
- RedJubjub / RedPallas: Schnorr-style. The randomizer for spend
  authorization signatures uses fresh entropy from the prover.
  Re-randomization without re-knowledge of the secret should be
  infeasible.

### proof soundness

- Groth16 (Sapling, Sprout-on-Groth16): pairing-based, sound under
  the q-PKE assumption. Trusted setup is the open exposure (see
  file 10).
- Halo2 (Orchard): IPA-based, no trusted setup. The security
  argument is the soundness of the inner product argument plus the
  hardness of discrete log on Pallas.

Batch verification soundness: see file 11.

### trusted setup compromise

If the Sapling MPC was compromised, an attacker can produce valid
Sapling spend / output proofs for false statements. The MPC was run
across many independent participants, with each participant's
contribution publicly verifiable. The defense is "at least one
honest participant"; if you do not believe that, you cannot trust
Sapling. Orchard does not have this exposure.

### hash collision / preimage

BLAKE2 and SHA-2 are believed-secure. The interesting failure mode
is domain separation: every BLAKE2 call in Zcash uses a personal
string. Bugs in personal-string handling have caused security
incidents in past ZK systems.

## implementation adversaries

Anyone exploiting bugs in the node itself.

### resource exhaustion (DoS)

- malformed messages that trigger huge allocations: defended by
  `TrustedPreallocate` in `zebra-chain/src/serialization/`. Every
  deserializer for attacker-controlled bytes must compute a hard
  upper bound on its allocation.
- request floods: defended by Tower backpressure, bounded channels,
  inbound queue overflow drops the connection.
- mempool flooding: defended by ZIP-401 anti-DoS (size, fee, weight
  limits).
- proof verification timeouts: bound on per-block verification time.
- panic-on-DoS: clippy lints `unwrap_used`, `expect_used`, `panic`
  in critical paths.

### panic and crash

Zebra is consensus-critical. A panic is a chain-stall for the
operator. The lint policy and the AGENTS.md guidance "expect()
messages must explain why the invariant holds" are the discipline.

### ffi memory issues

`zebra-script` is the unsafe boundary. The wrapper is single-
crate so the rest of the workspace can keep `unsafe_code = "deny"`.
The `comparison-interpreter` feature runs a parallel Rust
implementation against the C++ one to catch divergence.

### supply chain

The dependency surface (see `Cargo.toml`) is large. `deny.toml`
configures `cargo-deny` for license, advisory, and source checks.
The `supply-chain/` directory in the repo root holds the
`cargo-vet` audit data.

### timing side channels

The Rust crypto crates (`jubjub`, `pasta_curves`, `bls12_381`,
`ed25519-zebra`, `secp256k1`) make varying constant-time
guarantees. See file 11 for the review discipline.

## what this means in practice

When reviewing a PR, walk through each adversary category and ask:
does this change make any of them easier? When designing a new
feature, list the adversaries it must defend against before writing
code. This is the principal-level habit that separates a working
node from a robust one.

## see also

- 10-incidents-and-audits.md (concrete past examples).
- 11-cryptographic-correctness-practices.md (the discipline).
- `book/src/dev/rfcs/0003-inventory-tracking.md` (network defense
  detail).
- `SECURITY.md` at the repo root for responsible disclosure.
