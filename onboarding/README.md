# Zebra Onboarding Course

A personal, code-anchored onboarding course for
[Zebra](https://github.com/ZcashFoundation/zebra), built as a
Docusaurus 3 site and deployed to GitHub Pages from this same
`onboarding` branch via
[`.github/workflows/onboarding-docs.yml`](../.github/workflows/onboarding-docs.yml).

The course content lives in [`docs/`](./docs); start at
[`docs/index.md`](./docs/index.md) and read in numeric order.

## Local development

```bash
make install   # npm install
make dev       # http://localhost:3000 (live reload)
make build     # static build under build/
make preview   # serve the build output
make audit     # npm audit
```

See [`Makefile`](./Makefile) for the full set of targets.

## Deployment

The course deploys automatically on push to the `onboarding` branch:
the workflow builds the static site under `onboarding/build/` and
overlays it onto the root of the same branch, where GitHub Pages
serves it as `https://dannywillems.github.io/zebra/`.

One-time GitHub Pages setup (Settings -> Pages -> Build and
deployment):

- Source: Deploy from a branch
- Branch: `onboarding`, folder `/ (root)`

## Disclaimer

This site is auto-generated using Claude Code. It may be wrong. The
code in the upstream
[`ZcashFoundation/zebra`](https://github.com/ZcashFoundation/zebra)
repository is the law. The course pins all live source embeds to
the [`v4.4.1`](https://github.com/ZcashFoundation/zebra/tree/v4.4.1)
release tag.
