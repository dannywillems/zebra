#!/usr/bin/env bash
# The canonical local CI sequence. Every PR must pass these four checks
# before it stands a chance upstream. Source of truth for the commands
# cited in onboarding chapter 01 and 07.
set -euo pipefail

cargo build --workspace --locked
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
