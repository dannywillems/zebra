# 20. time, clocks, and difficulty

Consensus-critical time logic is consistently underrated as a bug
source. This file is the survival guide.

## three notions of time in zcash

1. **block timestamp (header.time)**: a uint32 Unix timestamp in
   the block header. The miner chooses it, within consensus bounds.
2. **median time past (MTP)**: the median of the previous 11
   blocks' timestamps. Used by various consensus checks because it
   is harder for a miner to manipulate than a single timestamp.
3. **network adjusted time**: the local node's view of "now",
   adjusted by samples from peers' reported clocks. Used for the
   future-time bound on incoming blocks.

These three are *not* interchangeable. The consensus rules specify
exactly which one applies to each check.

## block timestamp consensus rules

For each new block, the block timestamp must satisfy:

- **past bound**: greater than the median time past of the previous
  11 blocks. (Equivalent to: `header.time > MTP(prev_11)`.)
- **future bound**: less than network-adjusted-time plus a fixed
  tolerance (typically 90 minutes; verify against the spec).
- **monotonicity is not required**: individual block timestamps
  can decrease, as long as MTP increases.

Implementation:
- past bound is checked in `zebra-state/src/service/check/`.
- future bound is checked at block reception, in
  `zebra-consensus`.

## why MTP exists

A single miner can stamp a block 30 minutes in the future to bias
difficulty downward (older "now" means more time passed, means
lower target). MTP averages over 11 blocks, requiring 6 colluding
miners to bias it. With reasonable hashpower distribution, this is
infeasible.

Used for:

- difficulty adjustment.
- transparent script `OP_CHECKLOCKTIMEVERIFY` and
  `OP_CHECKSEQUENCEVERIFY` (when in MTP mode).
- lock-time evaluation for transactions.

## difficulty adjustment

Zcash uses a per-block difficulty adjustment based on a rolling
window. The relevant constants (per the spec):

- `PoWAveragingWindow`: 17 (number of blocks in the window).
- `PoWMedianBlockSpan`: 11 (the MTP window).
- `PoWMaxAdjustDown` / `PoWMaxAdjustUp`: bounded adjustment per
  block.
- `PoWTargetSpacing`: target seconds per block. Halved at Blossom
  (ZIP-208) from 150 to 75 seconds.

The algorithm: compute the MTP-based actual time elapsed over the
last `PoWAveragingWindow` blocks; compute the expected elapsed time
(`PoWTargetSpacing * PoWAveragingWindow`); adjust the previous
target by their ratio, clamped to the up/down bounds.

Implementation:
- algorithm in `zebra-state/src/service/check/difficulty.rs` (or
  similar; verify in the current tree).
- relevant constants in `zebra-chain/src/work/difficulty/`.
- the RFC discussion is in `book/src/dev/rfcs/0006-contextual-
  difficulty.md`.

## time-warp considerations

A time-warp attack tries to bias the difficulty algorithm by
stamping blocks with carefully chosen timestamps. Bitcoin's
adjustment-every-2016-blocks scheme has a well-known time-warp
exposure that Bitcoin Cash patched (ZIP-208-like fix).

Zcash's per-block adjustment dramatically reduces but does not
eliminate this exposure. The bounded `PoWMaxAdjustDown` /
`PoWMaxAdjustUp` clamps the per-block effect.

Things to verify when reviewing time-related code:

- the bound check uses the right window (`PoWAveragingWindow` vs
  `PoWMedianBlockSpan`).
- the bound check uses MTP, not raw timestamps, when the spec
  mandates MTP.
- the clamp is applied symmetrically (both up and down).

## blossom changes

Blossom (December 2019) halved `PoWTargetSpacing` from 150s to 75s
and adjusted the founders' reward / subsidy schedule to match. The
sub-protocol changes are in ZIP-208. The implementation must select
the right `PoWTargetSpacing` based on block height; this is a
height-dependent constant.

When reviewing any subsidy or difficulty calculation, confirm the
spacing is the post-Blossom value above the activation height.

## transaction expiry

Transactions carry an `expiryHeight` field (since Overwinter,
ZIP-203). A transaction is invalid if included in a block at a
height greater than `expiryHeight` (with `expiryHeight == 0`
meaning "no expiry").

Implication for the mempool: entries are evicted when the tip height
exceeds their `expiryHeight`. See file 18.

## the network-adjusted-time clock

`zebra-network` samples peer clock offsets during the `version`
handshake. The local "now" is then median-adjusted. This is used
purely for the future-bound on incoming block timestamps.

Failure mode: if a node's local clock is far off and its peers are
all running in a similar wrong-time configuration, the
network-adjusted clock confirms the wrong time. Defense: monitor the
clock offset metric and alert operators to large drift.

## what to watch when porting time-related code

- always specify which clock (MTP, header.time, network-adjusted)
  is being used.
- always specify the bound direction (greater-than, less-than, or
  ranges) explicitly.
- never assume a timestamp is monotonic across blocks.
- never compare timestamps with `==`; consensus rules use ordering.
- never store a chrono `DateTime<Utc>` for consensus-relevant data;
  use the integer Unix timestamp the spec specifies.

## suggested exercises

1. find `header.time` in `zebra-chain/src/block/header.rs`. Where
   is it bounded above, and where is it bounded below?
2. find the MTP computation. Confirm it uses the previous 11
   blocks, not including the current one.
3. compute, by hand, the difficulty adjustment for an arbitrary
   17-block window. Compare to the code's output.
4. find every use of `network-adjusted time` and confirm none of
   them feed into a consensus rule (only into reception filtering).

## see also

- `book/src/dev/rfcs/0006-contextual-difficulty.md`.
- ZIP-203 (transaction expiry).
- ZIP-208 (Blossom block time changes).
- Bitcoin time-warp literature for context.
