# What Changed Since `eagle-plugin-template`

This document explains the design change between the older `eagle-plugin-template` repository and the current `eagle-template` structure.

## Summary

The old template used GitHub Actions for both release packaging and template-update orchestration.

This template narrows that scope:

- local maintenance and update flow is driven by `lefthook`
- template-owned automation is kept under `.eagleplus/`
- GitHub Actions remains only for packaging and release creation

The goal is not to remove CI entirely. The goal is to stop using CI for work that is more transparent and easier to debug when it runs locally.

## What the old design did

The earlier `eagle-plugin-template` design included:

- workflow-driven packaging and release creation
- workflow-driven template updates
- optional scheduled update checks
- token-based authentication through `GH_TOKEN`
- template-target configuration for remote sync behavior
- script and workflow propagation through GitHub Actions

That design was capable, but it bundled together two different concerns:

- release automation
- day-to-day template maintenance

Those concerns have different operational needs, so putting both inside GitHub Actions made the overall system heavier than it needed to be.

## Why the new design is different

### Local-first update chain

The update chain now lives locally instead of behind GitHub Actions.

That means:

- the update logic is inspectable in `.eagleplus/scripts/`
- the maintenance flow runs where development actually happens
- iteration does not depend on remote workflow runs
- debugging does not require translating YAML behavior back into local intent

### Narrower template ownership

Template sync is intentionally restricted.

The template is allowed to update only:

- one configured workflow under `.github/workflows`
- files inside `.eagleplus/scripts`
- `lefthook.yaml` when `syncLefthook` is enabled

This prevents the template from quietly taking ownership of unrelated repository files.

### Cleaner responsibility split

The new split is:

- `lefthook` for local workflow enforcement
- `.eagleplus` for template-owned automation logic
- GitHub Actions for remote packaging and release publication

This is the core architectural decision of the repo.

## Tradeoffs

The current model is simpler, but not free.

### Advantages

- faster feedback for maintenance and update work
- less CI configuration to maintain
- clearer ownership boundaries
- fewer secrets and remote automation dependencies for normal updates
- easier local debugging of template behavior

### Costs

- contributors must have `lefthook` installed if they want hooks to run automatically
- update behavior is no longer centered in GitHub Actions history
- some teams may still prefer CI validation if the consumer repos become more complex

## What stayed in GitHub Actions

Packaging still belongs in GitHub Actions.

That is intentional because packaging benefits from:

- a clean runner environment
- reproducible release publication
- artifact attachment to tagged releases
- repository-hosted distribution flow

The important difference is that the workflow now calls template-owned local packaging logic instead of duplicating packaging behavior in YAML.

## Practical consequence

If a maintainer wants to understand how this template works, the primary places to read are:

- `.eagleplus/config/pkg-rules.json`
- `.eagleplus/config/template-target.json`
- `.eagleplus/scripts/`
- `.github/workflows/package-plugin.yml`

The README should describe the current contract.

This document should carry the historical comparison and rationale.
