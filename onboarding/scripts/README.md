# Onboarding command scripts

Shell scripts holding the commands cited in the onboarding chapters.
Two reasons to keep them as files:

1. **Single source of truth.** Chapters embed these scripts via the
   `reference` code-block (the same mechanism that pins Rust source
   excerpts to upstream Zebra at `v4.4.1`). When a command changes,
   the script changes and every embed updates with it.
2. **Runnable.** Each script can be invoked directly; the chapter
   prose only narrates around it.

| Script                                    | Cited in                                              |
| ----------------------------------------- | ----------------------------------------------------- |
| `ci-sequence.sh`                          | Chapter 01, 07. The four checks every PR must pass.  |
| `build-and-run-zebrad.sh`                 | Chapter 01. Release build then `zebrad start`.       |
| `test-focused.sh`                         | Chapter 07. Single-crate and single-test invocation. |
| `nextest-sync-large-checkpoints.sh`       | Chapter 07. End-to-end sync integration profile.     |
| `cargo-doc-open.sh`                       | Chapter 01. Build and open workspace rustdoc.        |
| `inspect-state-logs.sh`                   | Chapter 04. CF sizes from `zebrad` startup logs.     |
| `inspect-state-ldb.sh`                    | Chapter 04. Raw RocksDB inspection via `ldb`.        |
