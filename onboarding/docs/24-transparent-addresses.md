---
sidebar_position: 24
title: "Transparent Address Types"
description:
  "Every transparent address type Zebra models: P2PKH, P2SH, the redeem-script
  indirection, and ZIP-320 TEX addresses, with encodings, scriptPubKey
  templates, opcodes, and test vectors."
---

# Transparent Address Types

## Why This Chapter Exists

Zebra models exactly three transparent address types: P2PKH, P2SH, and ZIP-320
TEX. They all live in one enum,
[`transparent::Address`](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-chain/src/transparent/address.rs).
The narrative for the transparent pool sits inside
[chapter 02](./02-zebra-chain.md#transparent); this chapter is the flat
reference: each variant, its encoding, the `scriptPubKey` it produces, the
opcodes involved, and the real test vectors the crate ships.

Two facts frame everything below:

1. A transparent address is a 20-byte hash plus a network and type tag. It is
   not a script and not a key. The hash commits to either a public key (P2PKH)
   or a redeem script (P2SH); TEX commits to a validating key hash but is
   source-only.
2. Zebra only models the address types that have a standard textual encoding.
   Bare pay-to-public-key and bare multisig scripts can still appear in
   transaction outputs as raw
   [`Script`](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-chain/src/transparent/script.rs)
   bytes, but they have no `Address` representation and no `t`-string.

## The Address Enum

All three variants carry a `NetworkKind` and a 20-byte hash. The only structural
difference is what that hash is a hash of, and how it is encoded as text.

```rust reference title="zebra-chain/src/transparent/address.rs (Address enum)"
https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-chain/src/transparent/address.rs#L27-L57
```

### Type and Encoding Table

Zcash uses **two** version bytes where Bitcoin uses one. Together with the
Base58Check length, those bytes fix the human-readable prefix of the encoded
string. This is why Zcash transparent addresses begin with `t` and a digit, and
why a Zcash address cannot be parsed as a Bitcoin address simply by dropping the
`t`.

| Variant              | Hash is a hash of      | Encoding    | Mainnet prefix bytes | Mainnet string | Testnet prefix bytes | Testnet string |
| -------------------- | ---------------------- | ----------- | -------------------- | -------------- | -------------------- | -------------- |
| `PayToPublicKeyHash` | a compressed pubkey    | Base58Check | `0x1C 0xB8`          | `t1...`        | `0x1D 0x25`          | `tm...`        |
| `PayToScriptHash`    | a redeem script        | Base58Check | `0x1C 0xBD`          | `t3...`        | `0x1D 0xBA`          | `t2...`        |
| `Tex` (ZIP-320)      | a P2PKH validating key | Bech32m     | HRP `tex`            | `tex1...`      | HRP `textest`        | `textest1...`  |

The Base58Check prefix bytes come from
[`NetworkKind`](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-chain/src/parameters/network.rs#L64-L107),
which sources them from `zcash_protocol::constants`:

```rust reference title="zebra-chain/src/parameters/network.rs (address prefixes)"
https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-chain/src/parameters/network.rs#L64-L107
```

## P2PKH: Pay to Public Key Hash

A P2PKH address commits to a single public key. The `pub_key_hash` is 20 bytes:
`RIPEMD-160(SHA-256(compressed secp256k1 public key))`. The public key itself is
a 33-byte compressed secp256k1 encoding (see
[`transparent/keys.rs`](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-chain/src/transparent/keys.rs),
which reads exactly 33 bytes).

The `scriptPubKey` that locks a P2PKH output is the standard Bitcoin template:

```
OP_DUP OP_HASH160 <20-byte pubkey hash> OP_EQUALVERIFY OP_CHECKSIG
```

To spend it, the input supplies a signature and the full public key; the script
duplicates the key, hashes it, checks the hash matches the committed
`pub_key_hash`, then verifies the signature.

### Compressed vs Uncompressed Public Keys

A secp256k1 public key is a curve point $(x, y)$, each coordinate 32 bytes.
There are two ways to serialize it:

| Encoding     | Layout                               | Size     |
| ------------ | ------------------------------------ | -------- |
| Uncompressed | `0x04` &#124;&#124; x &#124;&#124; y | 65 bytes |
| Compressed   | `0x02`/`0x03` &#124;&#124; x         | 33 bytes |

The compressed form stores only $x$ plus a one-byte prefix recording the parity
of $y$ (`0x02` even, `0x03` odd). This works because the curve equation
$y^2 = x^3 + 7$ fixes $y$ up to sign: given $x$ there are exactly two valid $y$
values, one even and one odd, and the prefix selects which. Decoding recovers
the full point with one modular square root.

This is not a free choice at the address layer. The `pub_key_hash` is computed
over the **serialized** key, so the same point hashes to different values, and
therefore different `t1.../tm...` addresses, under the two encodings. Zcash
standardizes on the **compressed** encoding: the protocol spec defines the P2PKH
hash over a compressed key, and Zebra's
[`PublicKey`](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-chain/src/transparent/keys.rs)
deserializer reads exactly 33 bytes, rejecting anything else as an
`"invalid secp256k1 compressed public key"`. There is no 65-byte path in Zebra.

When were uncompressed keys deprecated? There is no clean "removed at version X"
answer, and at the consensus level uncompressed keys were never formally
prohibited for transparent spends:

- A P2PKH output commits only to a 20-byte hash. The spender may reveal any key
  that hashes to that value, in either encoding, and supply a valid signature.
  Zcash has no SegWit, so it never inherited Bitcoin's
  [BIP-143](https://github.com/bitcoin/bips/blob/master/bip-0143.mediawiki)
  witness rule that requires compressed keys. So an uncompressed key in a legacy
  P2PKH spend remains script-valid.
- Compressed has been the **canonical and default** encoding since Zcash's
  mainnet launch (October 2016), inheriting Bitcoin's 2012 move to
  compressed-by-default wallets in
  [Bitcoin Core 0.6.0](https://bitcoin.org/en/release/v0.6.0). Zcash key and
  address standards built on
  [BIP-32](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki)
  derivation use compressed keys throughout.
- The closest Zcash-specific tightening was
  [zcash/zcash#968](https://github.com/zcash/zcash/issues/968), which made
  strict-DER signature encoding
  ([BIP-66](https://github.com/bitcoin/bips/blob/master/bip-0066.mediawiki)) a
  consensus rule from shortly after launch. That governs signature canonicity,
  not public-key compression, and does not reject uncompressed keys.

In short: uncompressed keys are legacy and effectively unused, and Zebra's type
layer only models the compressed encoding, but "deprecated" is a convention and
a wallet/spec default rather than a consensus prohibition.

## P2SH and the Redeem Script

A P2SH address commits to a **script**, not a key. The `script_hash` is 20
bytes: `RIPEMD-160(SHA-256(redeem script))`. The redeem script is any script the
recipient chooses, the most common being an `m`-of-`n` multisig. The address
itself reveals nothing about that script beyond its hash.

The `scriptPubKey` that locks a P2SH output is short:

```
OP_HASH160 <20-byte script hash> OP_EQUAL
```

The **redeem script** is the indirection that gives P2SH its name and its
usefulness:

- The sender only needs the recipient's `t3.../t2...` address. The sender does
  not need to know, or pay extra for, a complicated locking policy. Output size
  and fee are the same as any P2SH output regardless of how elaborate the redeem
  script is.
- The recipient (the spender) supplies the redeem script at **spend time**,
  inside the input's `scriptSig`, along with whatever data satisfies it
  (signatures, preimages). The consensus rule is: hash the supplied redeem
  script, check it equals the committed `script_hash`, then execute the redeem
  script against the remaining `scriptSig` data.
- Because the redeem script is only revealed when the output is spent, the
  policy stays private until use.

Zebra models the bytes and the hash here; the actual two-stage P2SH execution is
delegated to
[`zebra-script`](https://github.com/ZcashFoundation/zebra/tree/v4.4.1/zebra-script)
(FFI to `libzcash_script`). See [chapter 04](./04-consensus-and-state.md) for
where script verification is driven during block validation.

## How the scriptPubKey Is Built

`Address::script()` is the single function that turns an address into the
`scriptPubKey` used in a coinbase output. It encodes the two templates above
directly, and returns an **empty** script for TEX addresses (they are not a
spendable output target):

```rust reference title="zebra-chain/src/transparent/address.rs (Address::script)"
https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-chain/src/transparent/address.rs#L275-L302
```

The opcodes it uses are the only ones Zebra needs to define to build these
templates:

```rust reference title="zebra-chain/src/transparent/opcodes.rs"
https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-chain/src/transparent/opcodes.rs
```

| Opcode           | Byte   | Role                                            |
| ---------------- | ------ | ----------------------------------------------- |
| `OP_DUP`         | `0x76` | duplicate the top stack item (P2PKH)            |
| `OP_HASH160`     | `0xA9` | `RIPEMD-160(SHA-256(x))` of the top item        |
| `Push20Bytes`    | `0x14` | push the next 20 bytes (the hash literal)       |
| `OP_EQUALVERIFY` | `0x88` | check equality, fail the script if unequal      |
| `OP_EQUAL`       | `0x87` | check equality, push the boolean result (P2SH)  |
| `OP_CHECKSIG`    | `0xAC` | verify a signature against a public key (P2PKH) |

## TEX Addresses (ZIP-320)

A TEX address is a transparent-source-only address defined by
[ZIP-320](https://zips.z.cash/zip-0320.html). It encodes a 20-byte
`validating_key_hash` (the same kind of hash as a P2PKH key hash) using Bech32m
with the human-readable part `tex` (mainnet) or `textest` (testnet). Its purpose
is to signal that funds should originate from a transparent source, used in
flows that need to avoid certain privacy-leak patterns. It is a conversion and
policy target, not a coinbase output script, which is why `Address::script()`
returns an empty script for it.

## Parsing, Display, and Serialization

The textual encoding is handled by `FromStr` and `Display`; the binary wire form
is handled by `ZcashSerialize` / `ZcashDeserialize`. The two are not
interchangeable, and the code is explicit about why.

`FromStr` tries Base58Check first (the `t1/t3/tm/t2` prefixes), then falls back
to Bech32 for TEX (`tex/textest`). The Base58Check path runs through the binary
deserializer because those addresses carry the two version bytes on the wire;
the Bech32 path is decoded inline because a Bech32 textual address has no such
binary version prefix:

```rust reference title="zebra-chain/src/transparent/address.rs (FromStr)"
https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-chain/src/transparent/address.rs#L117-L158
```

The binary form is two version bytes followed by the 20-byte hash. The
deserializer matches the version bytes against the mainnet/testnet script and
pubkey prefixes and rejects anything else with `"bad t-addr version/type"`:

```rust reference title="zebra-chain/src/transparent/address.rs (ZcashDeserialize)"
https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-chain/src/transparent/address.rs#L190-L226
```

## Test Vectors

These come straight from the unit tests in
[`address.rs`](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-chain/src/transparent/address.rs#L362-L433),
so they are the most reliable way to recognize each type by sight:

| Type  | Network | Address                               |
| ----- | ------- | ------------------------------------- |
| P2PKH | Mainnet | `t1bmMa1wJDFdbc2TiURQP5BbBz6jHjUBuHq` |
| P2PKH | Testnet | `tmTc6trRhbv96kGfA99i7vrFwb5p7BVFwc3` |
| P2SH  | Mainnet | `t3Y5pHwfgHbS6pDjj1HLuMFxhFFip1fcJ6g` |
| P2SH  | Testnet | `t2L51LcmpA43UMvKTw2Lwtt9LMjwyqU2V1P` |

The `hash_payload` helper in the test module shows the P2PKH/P2SH hash
derivation: `RIPEMD-160(SHA-256(payload))`, always exactly 20 bytes, where the
payload is the serialized public key for P2PKH and the raw script bytes for
P2SH.

## Watch-Only Scripts

A watch-only script (or address) is a **wallet** concept. It is a script or
address the wallet tracks to detect incoming funds and report balances, but
cannot spend, because the wallet holds only the script, public key, or address,
not the corresponding private key. In `zcashd` this is the `ISMINE_WATCH_ONLY`
flag, populated by wallet RPCs such as `importaddress` and `importpubkey`.

Zebra is a validator node and ships **no wallet**, so it has no watch-only
support at all:

- It implements none of the wallet-import RPCs (`importaddress`, `importpubkey`,
  `z_importviewingkey`, and similar) and no key store.
- Its address-inspection RPCs reflect this. `validateaddress` and
  `z_validateaddress` always return `ismine: false`, because Zebra never owns or
  watches keys; see
  [`z_validate_address.rs`](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/zebra-rpc/src/methods/types/z_validate_address.rs).

Watching addresses on Zcash is the job of separate software (for example
[Zaino](https://github.com/zingolabs/zaino),
[Zallet](https://github.com/zcash/wallet), the `zcashd` wallet, or light
wallets), which query a validator like Zebra over RPC for the chain data they
need. This split is the same scope boundary called out for wallets, block
explorers, and mining pools in the project's
[`CLAUDE.md`](https://github.com/ZcashFoundation/zebra/blob/v4.4.1/CLAUDE.md).

## Spec Pointers

- Zcash protocol spec, section "Transparent Addresses"
  (`#transparentaddrencoding`), for the two-byte version encoding.
- [ZIP-320](https://zips.z.cash/zip-0320.html) for TEX addresses.
- Bitcoin developer guide on
  [P2PKH](https://developer.bitcoin.org/devguide/transactions.html#pay-to-public-key-hash-p2pkh)
  and
  [P2SH](https://developer.bitcoin.org/devguide/transactions.html#pay-to-script-hash-p2sh),
  which the `scriptPubKey` templates follow.

## Exercises

1. Decode `t3Y5pHwfgHbS6pDjj1HLuMFxhFFip1fcJ6g` by hand: strip the Base58Check
   checksum, confirm the first two bytes are `0x1C 0xBD`, and confirm the
   remaining payload is 20 bytes. Which `Address` variant does
   `zcash_deserialize` produce?
2. Write the exact `scriptPubKey` byte sequence that `Address::script()` emits
   for a mainnet P2PKH address with an all-zero pubkey hash. Check it against
   the opcode table.
3. Explain why two different redeem scripts can never share the same P2SH
   address except by a `RIPEMD-160(SHA-256(...))` collision, and why the sender
   does not need to know the redeem script to pay the address.
4. Find where a transparent `Output`'s `lock_script` is stored and verified
   during block validation. Hint: start in
   [`transparent/`](https://github.com/ZcashFoundation/zebra/tree/v4.4.1/zebra-chain/src/transparent)
   and follow the script into `zebra-script`.
