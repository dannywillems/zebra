#!/usr/bin/env bash
# The end-to-end sync test profile. Reproduces what CI runs for
# integration coverage. Requires the corresponding profile to be
# defined in .config/nextest.toml.
set -euo pipefail

cargo nextest run --profile sync-large-checkpoints-empty
