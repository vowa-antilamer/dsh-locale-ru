# dsh-locale-ru

[![npm version](https://img.shields.io/npm/v/dsh-locale-ru.svg)](https://www.npmjs.com/package/dsh-locale-ru)
[![npm license](https://img.shields.io/npm/l/dsh-locale-ru.svg)](LICENSE)
[![CI](https://github.com/vowa-antilamer/dsh-locale-ru/actions/workflows/ci.yml/badge.svg)](https://github.com/vowa-antilamer/dsh-locale-ru/actions/workflows/ci.yml)

Русификация веб-интерфейса [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).
Это языковой пакет для штатного сервиса `@deepseek-ai/dsh-client-locale`: он добавляет язык
**Русский** и регистрирует словари для **58 пространств имён / 3674 строк** — чат и composer,
диалог и траектория, все боковые панели, все страницы настроек, плагины и Cordis, цели и планы,
субагенты, вопросы и подтверждения, а также сторонние плагины `dsh-market` и `better-sidebar`.

[English documentation](README.md)

## Возможности

- Регистрирует `ru` с откатом на английский: ключ без перевода разрешается в `en` (затем в общее
  пространство `common`), поэтому неполный словарь никогда не ломает интерфейс.
- Выбирает русский **один раз** — при первой загрузке после установки (флаг в `localStorage`
  дальше отдаёт выбор вам); возврат на английский в настройках больше не переопределяется.
- Никаких зависимостей: host-половина пустая, клиентский модуль самодостаточен, поэтому пакет
  ставится в профиль, не трогая граф зависимостей.
- Сгенерированный артефакт и тесты, которые следят за полнотой и согласованностью словаря.

## Установка

### В профиль DSH

Откройте **Настройки → Плагины → Установить**, введите `dsh-locale-ru` и подтвердите. Менеджер
плагинов добавит пакет и строку в набор профиля; язык сразу появится в
**Настройки → Общие → Язык**.

Из локальной копии репозитория устанавливайте каталог:

```bash
dsh plugin --profile web add /path/to/dsh-locale-ru
```

затем добавьте `"dsh-locale-ru"` в список `dsh.profile.bundles` в `package.json` профиля
(мастер установки в интерфейсе делает оба шага сам).

### Переключение языка

**Настройки → Общие → Язык → Русский.** Выбор хранится в пользовательских настройках хоста и
переживает перезапуск. «English» возвращает английский.

## Что переведено

| Область | Пространства имён |
|---|---|
| Диалог и чат | `conversation`, `chat`, `command`, `slash.menu`, `input-trigger`, `reference` |
| Детали выполнения | `trajectory`, `workflowRun`, `subagent`, `agent-team`, `deliverables` |
| Боковые панели | `sidebar`, `sidebarFiles`, `sidebarRight`, `sidebarTerminal`, `sidebarBrowser`, `sidebarDocumentPreview`, `sidebarPdf`, `sidebarImage`, `sidebarOffice`, `sidebarExcel`, `documentMarkdown`, `documentHtml` |
| Настройки | `settings`, `settings.models`, `settings.plugins`, `settings.pluginInventory`, `settings.shell`, `settings.subagent`, `settings.agentLoop`, `settings.webSearch`, `settings.permission`, `permission.access`, `settings.theme`, `settings.sessionLog`, `settings.agentPreset`, `settings.locale` |
| Цели, планы, задачи | `goal`, `plan`, `job`, `schedule.catalog`, `schedule.manager`, `model` |
| Взаимодействие | `question`, `approval`, `feedback`, `skill`, `shortcuts`, `shortcuts.layout`, `common` |
| Плагины и инструменты | `pluginManager`, `cordis`, `session-log-download` |
| Сторонние плагины | `dsh-market`, `betterSidebar` |

## Разработка

В репозитории английский исходник лежит рядом с переводом, поэтому полноту можно проверять:

```
src/locales/<пространство>.json  { "<ключ>": { "en": "…", "ru": "…" } }
src/locales/chat.json            один файл на пространство имён (всего 58)
scripts/build.mjs                собирает lib/client.js из src/locales
scripts/extract-dictionaries.mjs служебная утилита: сравнить установленный DSH с src/locales
test/locale.test.mjs             тесты на node:test
lib/client.js                    сгенерированный клиентский модуль (в git и в npm-пакете)
```

```bash
npm run build     # пересобрать lib/client.js
npm run check     # упасть, если lib/client.js устарел (проверка для CI)
npm test          # структура модуля, регистрация языка, совпадение ключей и плейсхолдеров
npm run verify    # check + test
```

### Обновление словаря после обновления DSH

```bash
node scripts/extract-dictionaries.mjs /path/to/dsh/node_modules/@deepseek-ai
```

Утилита печатает найденные в установленных клиентских бандлах пространства имён и ключи вместе с
ключами, которых нет в `src/locales`. Добавьте новые строки с переводом и запустите
`npm run verify`.

## Ограничения

- Текст, который не проходит через сервис локализации, остаётся английским: служебные сообщения
  хоста вне интерфейса (например, простой текст `dsh web authentication required`) и плагины без
  собственных словарей (например, `dsh-hud`).
- В сервисе локализации нет правил множественного числа, поэтому строки со счётчиками используют
  формы, не зависящие от числа (`Файлов: {count}`).
- Пространства имён, которые монтируются только в Desktop-рендерере (`settings.account`),
  намеренно не переведены: веб-профиль их не загружает.

## Лицензия

[MIT](LICENSE)
