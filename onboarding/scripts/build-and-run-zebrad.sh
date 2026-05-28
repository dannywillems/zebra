#!/usr/bin/env bash
# Build Zebra in release mode and start the node with default config.
# Cited in onboarding chapter 01 (architecture / first build).
set -euo pipefail

cargo build --release
./target/release/zebrad start
