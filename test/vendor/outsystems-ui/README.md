# OutSystems UI runtime (test fixture)

Used only by `test/outsystems-provider.test.mjs`, to run the OrgChart provider against the real OutSystems UI
base classes. Not part of the distributed files: in an app, OutSystems UI is provided by the platform.

- `O11.OutSystemsUI-2.30.0.min.js`: compiled from https://github.com/OutSystems/outsystems-ui/tree/v2.30.0
  (`src/scripts`, O11 build), then minified with esbuild.
- `O11.OutSystemsUI-3.0.0.min.js`: compiled the same way from the repository's main branch (version 3.0.0).

The gulp build's `<->platformType<->` placeholder is replaced with `O11`.

OutSystems UI is licensed under the BSD 3-Clause License, see [LICENSE](LICENSE).
