#!/usr/bin/env bash
# Direct RocksDB inspection via ldb (rocksdb-tools). Run with Zebra
# stopped. Adjust the cache path and column family as needed.
#
# Decoding the raw bytes requires the matching IntoDisk / FromDisk
# impl from zebra-state/src/service/finalized_state/disk_format/.
set -euo pipefail

DB="${ZEBRA_CACHE_DIR:-${HOME}/.cache/zebra}/state/v27/mainnet"
CF="${1:-tip_chain_value_pool}"

ldb --db="${DB}" list_column_families
ldb --db="${DB}" --column_family="${CF}" scan --hex
