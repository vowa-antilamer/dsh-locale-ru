# dsh-locale-ru

[![npm version](https://img.shields.io/npm/v/dsh-locale-ru.svg)](https://www.npmjs.com/package/dsh-locale-ru)
[![npm license](https://img.shields.io/npm/l/dsh-locale-ru.svg)](LICENSE)
[![CI](https://github.com/vowa-antilamer/dsh-locale-ru/actions/workflows/ci.yml/badge.svg)](https://github.com/vowa-antilamer/dsh-locale-ru/actions/workflows/ci.yml)

Russian localization for the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) web GUI.
It is a language pack for the shipped `@deepseek-ai/dsh-client-locale` service: it adds the
**Русский** language and registers dictionaries for **60 message namespaces / 3843 strings** —
the chat and composer, the conversation and trajectory views, every sidebar, all settings pages,
plugins and Cordis, goals/plans/jobs, subagents, question and approval flows, plus the
third-party plugins `dsh-market`, `better-sidebar`, `dsh-pet` and `dsh-mcp`.

[Русская версия документации](README.ru.md)

## Features

- Registers `ru` with an English fallback: keys without a translation resolve to `en` (then to the
  shared `common` namespace), so a partial dictionary never breaks the UI.
- Selects Russian **once**, on the first page load after installation (a `localStorage` flag hands
  the choice to you afterwards) — switching back to English in Settings is never overridden.
- Covers third-party plugins: their dictionaries live in `src/locales/plugins/`, one file per
  namespace, and are registered one task after page boot, so a plugin that ships its own `ru`
  dictionary keeps ownership of its namespace instead of racing the pack for it.
- No runtime dependencies: the Host half is empty and the browser module is self-contained, so the
  package installs into a profile without touching the dependency graph.
- Generated artifact plus a test suite that keeps the dictionary complete and consistent, including
  a drift guard against every plugin installed next to the checkout.

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
| Conversation and chat | `conversation`, `chat`, `command`, `slash.menu`, `reference` |
| Execution details | `trajectory`, `workflowRun`, `subagent`, `agent-team`, `deliverables` |
| Sidebars | `sidebar`, `sidebarFiles`, `sidebarRight`, `sidebarTerminal`, `sidebarBrowser`, `sidebarCodePreview`, `sidebarDocumentPreview`, `sidebarPdf`, `sidebarImage`, `sidebarOffice`, `sidebarExcel`, `documentMarkdown`, `documentHtml` |
| Settings | `settings`, `settings.models`, `settings.plugins`, `settings.pluginInventory`, `settings.shell`, `settings.subagent`, `settings.agentLoop`, `settings.webSearch`, `settings.permission`, `permission.access`, `settings.theme`, `settings.sessionLog`, `settings.agentPreset`, `settings.locale` |
| Goals, plans, jobs | `goal`, `plan`, `job`, `schedule.catalog`, `schedule.manager`, `model` |
| Interaction | `question`, `approval`, `feedback`, `skill`, `shortcuts`, `shortcuts.layout`, `voice-input`, `common` |
| Plugins and tooling | `pluginManager`, `cordis`, `session-log-download`, `open-in-app` |
| Third-party plugins | `dsh-market`, `betterSidebar`, `pet`, `mcp` |

## Translating a third-party plugin

A client plugin either translates through the locale service (`ctx.locale.register(...)`) or, rarely,
through a dictionary of its own. The pack covers the first kind:

- `src/locales/plugins/<namespace>.json` holds one dictionary per plugin namespace, in the same
  `{ "<key>": { "en": "…", "ru": "…" } }` shape as the core files. Shipping the dictionary is enough:
  a namespace only shows up when the plugin that registers it is installed, so an unused dictionary
  costs nothing.
- Plugin namespaces register one task after page boot. The locale service rejects a second
  registration for the same `(namespace, locale)` pair, so claiming a namespace early would make a
  plugin's own `ru` dictionary throw; registering late lets that plugin win while the pack fills in
  the plugins that ship no Russian at all.
- The build refuses a namespace that is declared both as a core and as a plugin dictionary, because
  such a pair would be registered twice.

To add a plugin:

```bash
# 1. install the plugin into the profile, then diff the pack against the live installation
node scripts/extract-dictionaries.mjs <dsh>/node_modules/@deepseek-ai "$DSH_PROFILE_DIR/node_modules" --drafts
# 2. fill in "ru" in .plugin-drafts/<namespace>.json and move that file to src/locales/plugins/
npm run verify
```

The tool prints every namespace it finds, marks plugin-only ones `[plugin]`, and writes translation
drafts for whatever has no Russian yet (`--drafts`, git-ignored). Leave out the profile argument to
diff the core bundles only; `<dsh>` is the dsh installation directory (for an `npx` install it is
`~/.npm/_npx/<hash>`).

## Development

The repository keeps the English source next to every translation, so completeness is checkable:

```
src/locales/<namespace>.json          { "<key>": { "en": "…", "ru": "…" } } — core namespaces
src/locales/plugins/<namespace>.json  the same shape for third-party plugin namespaces
scripts/build.mjs                     renders lib/client.js from both directories
scripts/extract-dictionaries.mjs      maintainer tool: diff an installed DSH/profile, write drafts
test/locale.test.mjs                  node:test suite for the client module
test/plugins.test.mjs                 plugin namespace separation and drift guards
lib/client.js                         generated browser module (committed, shipped)
```

```bash
npm run build     # regenerate lib/client.js
npm run check     # fail when lib/client.js is stale (CI gate)
npm test          # module shape, language registration, key/placeholder/space parity
npm run verify    # check + test
```

### Updating the dictionary after a DSH upgrade

```bash
node scripts/extract-dictionaries.mjs /path/to/dsh/node_modules/@deepseek-ai "$DSH_PROFILE_DIR/node_modules"
```

Every namespace found in the installed bundles is diffed against `src/locales` and
`src/locales/plugins`: `MISSING` and `REMOVED` list key drift, `NEW` marks an untranslated
namespace, `UNUSED` marks a dictionary no installed bundle registers any more, and `OWN-RU` warns
that a plugin translates itself, so the pack's file for it must be dropped. Translate the new
entries, delete the dropped ones, then run `npm run verify`.

## Limitations

- Copy that never passes through the locale service stays untranslated: host-generated text outside
  the GUI (for example the plain-text `dsh web authentication required` response) and plugins that
  render their own dictionary instead of registering one — `@linxin666/dsh-pet` shows its settings
  page in Russian, but the floating sprite and its gameplay HUD resolve their copy from the plugin's
  own `zh`/`en` dictionary keyed on `document.documentElement.lang`, so they stay Chinese until that
  plugin translates through the locale service.
- A plugin with no dictionary here (for example `dsh-hud`) stays English: run the extractor above to
  see what is missing.
- The locale service has no plural rules, so count-bearing strings use number-independent phrasing
  (`Файлов: {count}`).
- Desktop-renderer-only namespaces such as `settings.account` are deliberately not translated: the
  web profile never mounts them.

## License

[MIT](LICENSE)
