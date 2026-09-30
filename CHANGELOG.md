# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/vowa-antilamer/dsh-locale-ru/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/vowa-antilamer/dsh-locale-ru/releases/tag/v1.0.0
