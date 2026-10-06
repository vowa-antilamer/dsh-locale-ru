# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.2.0] - 2026-10-06

### Added

- `gitGraph` namespace for the `dsh-git-graph` conversation tab label. The plugin's client
  half resolves that label through the locale seat (`ctx.locale.bind('gitGraph')`) and
  registers `zh`/`en` itself; upstream 0.14.0 ships the label hard-coded in Chinese with no
  locale integration at all, so this dictionary stays inert until that side lands (local
  patch or an upstream release). The graph page itself is a separate Chinese HTML document
  in an iframe and is not a locale-service surface.
- 61 namespaces / 3844 strings in total.

## [1.1.0] - 2026-10-06

### Added

- Translations for the third-party plugins `@linxin666/dsh-pet` (`pet`, 79 strings) and
  `@hyzyn/dsh-mcp` (`mcp`, 70 strings): 60 namespaces / 3843 strings in total.
- `src/locales/plugins/` for third-party plugin namespaces, which `dsh-market` and
  `betterSidebar` move into.
- Deferred registration of plugin namespaces: they are claimed one task after page boot, so a
  plugin that ships its own `ru` dictionary keeps ownership instead of losing the race.
- Plugin coverage tooling: `scripts/extract-dictionaries.mjs` now classifies every namespace as
  core or plugin, reports namespaces a plugin ships its own `ru` for, and writes
  `{ "en", "ru" }` drafts for untranslated keys with `--drafts`.
- Test suite: plugin/core namespace separation, deferred registration, plugin ownership, and a
  drift guard that compares every plugin dictionary with the installed plugin.

### Fixed

- `dsh-market`: the 22 keys added by newer plugin releases are translated, 2 dropped keys were
  removed, and 4 English sources were re-synced with the shipped wording.

### Changed

- Releases are cut on GitHub from a `v*` tag only: the npm publish step is gone, because the npm
  name `dsh-locale-ru` belongs to an unrelated project. Install the pack with
  `dsh plugin --profile web add github:vowa-antilamer/dsh-locale-ru`.

## [1.0.0] - 2026-09-30

### Added

- Russian (`ru`) language registration for the DeepSeek Harness web GUI with an English fallback.
- Dictionaries for 58 message namespaces / 3674 strings: chat and composer, conversation and
  trajectory, sidebars, settings pages, plugins and Cordis, goals, plans, jobs, subagents,
  questions, approvals, deliverables, shortcuts and shared primitives.
- Translations for the third-party `dsh-market` and `better-sidebar` plugins.
- One-time automatic selection of Russian on the first page load after installation.
- Build script (`scripts/build.mjs`), dictionary extractor
  (`scripts/extract-dictionaries.mjs`) and a `node:test` suite covering module shape, language
  registration and key/placeholder/whitespace parity.

[Unreleased]: https://github.com/vowa-antilamer/dsh-locale-ru/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/vowa-antilamer/dsh-locale-ru/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/vowa-antilamer/dsh-locale-ru/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/vowa-antilamer/dsh-locale-ru/releases/tag/v1.0.0
