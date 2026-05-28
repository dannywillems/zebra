#!/usr/bin/env bash
# Surface RocksDB column-family sizes from Zebra's own startup logs.
# Fastest way to confirm the database opened and how each family
# weighs. Cited in onboarding chapter 04 (storage inspection).
set -euo pipefail

RUST_LOG=zebra_state=debug zebrad start 2>&1 | grep "Column families and sizes"
