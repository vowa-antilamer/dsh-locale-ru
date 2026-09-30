# dsh-locale-ru

[![npm version](https://img.shields.io/npm/v/dsh-locale-ru.svg)](https://www.npmjs.com/package/dsh-locale-ru)
[![npm license](https://img.shields.io/npm/l/dsh-locale-ru.svg)](LICENSE)
[![CI](https://github.com/vowa-antilamer/dsh-locale-ru/actions/workflows/ci.yml/badge.svg)](https://github.com/vowa-antilamer/dsh-locale-ru/actions/workflows/ci.yml)

Russian localization for the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) web GUI.
It is a language pack for the shipped `@deepseek-ai/dsh-client-locale` service: it adds the
**Русский** language and registers dictionaries for **58 message namespaces / 3674 strings** —
the chat and composer, the conversation and trajectory views, every sidebar, all settings pages,
plugins and Cordis, goals/plans/jobs, subagents, question and approval flows, plus the
third-party `dsh-market` and `better-sidebar` plugins.

[Русская версия документации](README.ru.md)

## Features

- Registers `ru` with an English fallback: keys without a translation resolve to `en` (then to the
  shared `common` namespace), so a partial dictionary never breaks the UI.
- Selects Russian **once**, on the first page load after installation (a `localStorage` flag hands
  the choice to you afterwards) — switching back to English in Settings is never overridden.
- No runtime dependencies: the Host half is empty and the browser module is self-contained, so the
  package installs into a profile without touching the dependency graph.
- Generated artifact plus a test suite that keeps the dictionary complete and consistent.

## Install

### Into a DSH profile

Open **Settings → Plugins → Install**, enter `dsh-locale-ru`, and confirm. The plugin manager adds
the package and its bundle row; the language appears immediately in
**Settings → General → Language**.

From a checkout of this repository, install the local directory instead:

```bash
dsh plugin --profile web add /path/to/dsh-locale-ru
```

then add `"dsh-locale-ru"` to the `dsh.profile.bundles` list in the profile's `package.json`
(the plugin manager UI does both steps for you).

### Switch the language

**Settings → General → Language → Русский.** The choice is stored in the host settings document and
survives a restart. `English` switches back.

## What is translated

| Area | Namespaces |
|---|---|
| Conversation and chat | `conversation`, `chat`, `command`, `slash.menu`, `input-trigger`, `reference` |
| Execution details | `trajectory`, `workflowRun`, `subagent`, `agent-team`, `deliverables` |
| Sidebars | `sidebar`, `sidebarFiles`, `sidebarRight`, `sidebarTerminal`, `sidebarBrowser`, `sidebarDocumentPreview`, `sidebarPdf`, `sidebarImage`, `sidebarOffice`, `sidebarExcel`, `documentMarkdown`, `documentHtml` |
| Settings | `settings`, `settings.models`, `settings.plugins`, `settings.pluginInventory`, `settings.shell`, `settings.subagent`, `settings.agentLoop`, `settings.webSearch`, `settings.permission`, `permission.access`, `settings.theme`, `settings.sessionLog`, `settings.agentPreset`, `settings.locale` |
| Goals, plans, jobs | `goal`, `plan`, `job`, `schedule.catalog`, `schedule.manager`, `model` |
| Interaction | `question`, `approval`, `feedback`, `skill`, `shortcuts`, `shortcuts.layout`, `common` |
| Plugins and tooling | `pluginManager`, `cordis`, `session-log-download` |
| Third-party plugins | `dsh-market`, `betterSidebar` |

## Development

The repository keeps the English source next to every translation, so completeness is checkable:

```
src/locales/<namespace>.json     { "<key>": { "en": "…", "ru": "…" } }
src/locales/chat.json            one file per message namespace (58 files)
scripts/build.mjs                renders lib/client.js from src/locales
scripts/extract-dictionaries.mjs maintainer tool: diff an installed DSH against src/locales
test/locale.test.mjs             node:test suite
lib/client.js                    generated browser module (committed, shipped)
```

```bash
npm run build     # regenerate lib/client.js
npm run check     # fail when lib/client.js is stale (CI gate)
npm test          # module shape, language registration, key/placeholder/space parity
npm run verify    # check + test
```

### Updating the dictionary after a DSH upgrade

```bash
node scripts/extract-dictionaries.mjs /path/to/dsh/node_modules/@deepseek-ai
```

The tool prints every namespace and key it finds in the installed client bundles together with the
keys missing from `src/locales`. Add the new entries (with a Russian translation), then run
`npm run verify`.

## Limitations

- Copy that never passes through the locale service stays English: host-generated text outside the
  GUI (for example the plain-text `dsh web authentication required` response) and plugins that ship
  no locale dictionaries (for example `dsh-hud`).
- The locale service has no plural rules, so count-bearing strings use number-independent phrasing
  (`Файлов: {count}`).
- Desktop-renderer-only namespaces such as `settings.account` are deliberately not translated: the
  web profile never mounts them.

## License

[MIT](LICENSE)
