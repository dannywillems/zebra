#!/usr/bin/env bash
# Run a single crate's tests, or a single test by name. Useful while
# iterating on a contained change.
set -euo pipefail

# Single crate.
cargo test -p zebra-chain

# Single test by name (uncomment and edit):
# cargo test -p zebra-chain -- some_test_name
