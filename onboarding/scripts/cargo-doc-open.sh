#!/usr/bin/env bash
# Build workspace documentation locally and open in the browser. Useful
# for navigating types across the 12 crates without leaving the editor.
set -euo pipefail

cargo doc --workspace --no-deps --open
