/**
 * Maintainer tool: read the locale dictionaries an installed DSH ships — the core client
 * bundles plus every installed client plugin in a profile — and diff them against
 * `src/locales` (core namespaces) and `src/locales/plugins` (third-party plugins).
 *
 * Usage:
 *   node scripts/extract-dictionaries.mjs <dsh-packages-dir> [<profile-node-modules>] [--drafts[=<dir>]]
 *
 * <dsh-packages-dir> is usually <dsh>/node_modules/@deepseek-ai, and the optional second
 * argument points at a profile's node_modules, which is what makes plugin namespaces
 * visible. `--drafts` writes `{ "en": …, "ru": "" }` stubs for every key that has no
 * translation yet (default directory: `.plugin-drafts/`, which is git-ignored); fill the
 * Russian values in and move the file into `src/locales` or `src/locales/plugins`.
 *
 * Namespaces are classified by where they were found: a namespace that only an installed
 * plugin registers is a *plugin* namespace and belongs in `src/locales/plugins`.
 *
 * The scanning helpers are exported for the test suite.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const CORE_DIR = path.join(root, 'src/locales')
export const PLUGIN_DIR = path.join(root, 'src/locales/plugins')

/** Namespaces that never mount in the web profile and are deliberately not translated. */
export const SKIP_NAMESPACES = new Set(['settings.account'])

// ---------------------------------------------------------------- JS scanning

function splitArgs(src, start) {
  let i = start + 1
  let depth = 0
  let inStr = null
  const out = []
  let cur = ''
  for (; i < src.length; i++) {
    const c = src[i]
    if (inStr) {
      cur += c
      if (c === '\\') { cur += src[++i] ?? ''; continue }
      if (c === inStr) inStr = null
      continue
    }
    if (c === '"' || c === "'" || c === '`') { inStr = c; cur += c; continue }
    if (c === '(' || c === '[' || c === '{') { depth++; cur += c; continue }
    if (c === ')' && depth === 0) { out.push(cur); return { args: out, end: i } }
    if (c === ')' || c === ']' || c === '}') { depth--; cur += c; continue }
    if (c === ',' && depth === 0) { out.push(cur); cur = ''; continue }
    cur += c
  }
  return { args: out, end: i }
}

function takeBalanced(src, start, open, close) {
  let depth = 0
  let inStr = null
  for (let i = start; i < src.length; i++) {
    const c = src[i]
    if (inStr) {
      if (c === '\\') { i++; continue }
      if (c === inStr) inStr = null
      continue
    }
    if (c === '"' || c === "'" || c === '`') { inStr = c; continue }
    if (c === open) depth++
    else if (c === close) { depth--; if (depth === 0) return src.slice(start, i + 1) }
  }
  return null
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function tryEval(text) {
  try {
    return Function('"use strict";return (' + text + ')')()
  } catch {
    return undefined
  }
}

function stripStrings(text) {
  let out = ''
  let inStr = null
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inStr) {
      if (c === '\\') { i++; continue }
      if (c === inStr) { inStr = null; out += ' ' }
      continue
    }
    if (c === '"' || c === "'" || c === '`') { inStr = c; continue }
    out += c
  }
  return out
}

/** Resolve `const NAME = <literal>` declared before `before`, following identifier references. */
function resolveValue(src, name, before, depth = 0) {
  if (depth > 4) return undefined
  const re = new RegExp('\\b(?:const|let|var)\\s+' + esc(name) + '\\s*=', 'g')
  let last
  let m
  while ((m = re.exec(src))) {
    if (m.index >= before) break
    last = m
  }
  if (!last) return undefined
  let p = last.index + last[0].length
  while (p < src.length && /\s/.test(src[p])) p++
  const c0 = src[p]
  let lit
  if (c0 === '{') lit = takeBalanced(src, p, '{', '}')
  else if (c0 === '[') lit = takeBalanced(src, p, '[', ']')
  else if (c0 === '"' || c0 === "'" || c0 === '`') {
    for (let i = p + 1; i < src.length; i++) {
      if (src[i] === '\\') { i++; continue }
      if (src[i] === c0) { lit = src.slice(p, i + 1); break }
    }
  } else {
    const idm = /^[A-Za-z_$][\w$]*/.exec(src.slice(p))
    if (idm && idm[0] !== name) return resolveValue(src, idm[0], last.index, depth + 1)
    return undefined
  }
  if (!lit) return undefined
  const direct = tryEval(lit)
  if (direct !== undefined) return direct
  const env = {}
  for (const id of stripStrings(lit).matchAll(/[A-Za-z_$][\w$]*/g)) {
    const n = id[0]
    if (n === name || ['const', 'let', 'var', 'true', 'false', 'null'].includes(n)) continue
    const v = resolveValue(src, n, last.index, depth + 1)
    if (v !== undefined) env[n] = v
  }
  try {
    const keys = Object.keys(env)
    return Function(...keys, '"use strict";return (' + lit + ')')(...keys.map((k) => env[k]))
  } catch {
    return undefined
  }
}

function resolvePairs(src, name, before) {
  const re = new RegExp('\\b(?:const|let|var)\\s+' + esc(name) + '\\s*=\\s*\\[', 'g')
  let m
  while ((m = re.exec(src))) {
    if (m.index >= before) return undefined
    const at = src.indexOf('[', m.index + m[0].length - 1)
    const lit = takeBalanced(src, at, '[', ']')
    if (!lit) return undefined
    const value = tryEval(lit)
    if (value) return value
  }
  return undefined
}

/**
 * Extract every `locale.register(...)` dictionary from one built client bundle.
 * @param file - bundle path (read as UTF-8).
 * @param found - accumulator: `{ [namespace]: { zh?, en?, ru?, … } }`.
 */
export function scanBundle(file, found) {
  const src = fs.readFileSync(file, 'utf8')
  const re = /\blocale\.register\s*\(/g
  let m
  while ((m = re.exec(src))) {
    const at = m.index
    const { args } = splitArgs(src, at + m[0].length - 1)
    if (args.length < 2) continue
    let ns = args[0].trim()
    ns = /^["']/.test(ns) ? ns.slice(1, -1) : resolveValue(src, ns, at)
    if (typeof ns !== 'string') continue

    const record = (locale, dict) => {
      if (!locale || !dict || typeof dict !== 'object') return
      found[ns] ??= {}
      found[ns][locale] = { ...(found[ns][locale] ?? {}), ...dict }
    }

    if (args.length >= 3) {
      let loc = args[1].trim()
      loc = /^["']/.test(loc) ? loc.slice(1, -1) : resolveValue(src, loc, at)
      let dict = tryEval(args[2])
      if (!dict && /^[A-Za-z_$][\w$]*$/.test(args[2].trim())) dict = resolveValue(src, args[2].trim(), at)
      if (!loc) {
        const pairs = resolvePairs(src, args[1].trim(), at)
        if (Array.isArray(pairs)) for (const pair of pairs) if (Array.isArray(pair) && pair.length === 2) record(pair[0], pair[1])
        continue
      }
      record(loc, dict)
      continue
    }

    const literal = args[1].trim()
    if (literal.startsWith('{') && !literal.includes(':')) {
      for (const name of literal.slice(1, -1).split(',').map((s) => s.trim()).filter(Boolean)) {
        const value = resolveValue(src, name, at)
        const locale = /^zh/i.test(name) ? 'zh' : /^en/i.test(name) ? 'en' : name
        record(locale, value)
      }
      continue
    }
    const direct = tryEval(literal)
    if (direct) {
      for (const [locale, dict] of Object.entries(direct)) record(locale, dict)
      continue
    }
    for (const [, key, value] of literal.matchAll(/([A-Za-z_$][\w$]*)\s*(?::\s*([A-Za-z_$][\w$]*))?/g)) {
      const name = value ?? key
      const dict = resolveValue(src, name, at)
      const locale = /^zh/i.test(name) || /^zh/i.test(key) ? 'zh' : /^en/i.test(name) || /^en/i.test(key) ? 'en' : name
      record(locale, dict)
    }
  }
}

function walk(dir, visit) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
      walk(p, visit)
    } else if (entry.name === 'client.js' || entry.name === 'client.mjs') visit(p)
  }
}

/**
 * Scan every client bundle under one directory tree.
 * @param dir - directory to walk (`<dsh>/node_modules/@deepseek-ai`, a profile node_modules, …).
 * @returns `{ [namespace]: { [locale]: dictionary } }`.
 */
export function scanClientBundles(dir) {
  const found = {}
  if (fs.existsSync(dir)) walk(dir, (file) => scanBundle(file, found))
  return found
}

/** Read one dictionary directory into `{ [namespace]: pairs }`. */
export function readDictionaryDir(dir) {
  const out = {}
  if (!fs.existsSync(dir)) return out
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
    out[file.slice(0, -5)] = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'))
  }
  return out
}

// ------------------------------------------------------------------- reporting

const isMain = process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMain) {
  const argv = process.argv.slice(2)
  const draftsArg = argv.find((a) => a === '--drafts' || a.startsWith('--drafts='))
  const draftsDir = draftsArg === undefined
    ? undefined
    : path.resolve(root, draftsArg.includes('=') ? draftsArg.slice('--drafts='.length) : '.plugin-drafts')
  const [packagesDir, profileDir] = argv.filter((a) => !a.startsWith('--'))

  if (!packagesDir || !fs.existsSync(packagesDir)) {
    console.error('usage: node scripts/extract-dictionaries.mjs <dsh-packages-dir> [<profile-node-modules>] [--drafts[=<dir>]]')
    process.exit(2)
  }

  const coreFound = scanClientBundles(packagesDir)
  const pluginFound = {}
  if (profileDir && fs.existsSync(profileDir)) {
    for (const [ns, locales] of Object.entries(scanClientBundles(profileDir))) {
      if (ns in coreFound) continue
      pluginFound[ns] = locales
    }
  }
  const found = { ...coreFound, ...pluginFound }

  const coreLocal = readDictionaryDir(CORE_DIR)
  const pluginLocal = readDictionaryDir(PLUGIN_DIR)
  const local = { ...coreLocal, ...pluginLocal }
  const localDirOf = (ns) => (ns in pluginLocal ? 'src/locales/plugins' : 'src/locales')

  let missingKeys = 0
  let removedKeys = 0
  let draftFiles = 0
  const drafts = {}

  for (const ns of Object.keys(found).sort()) {
    if (SKIP_NAMESPACES.has(ns)) continue
    const kind = ns in pluginFound ? 'plugin' : 'core'
    const shipped = Object.keys(found[ns].en ?? {})
    const ours = local[ns]
    const tag = kind === 'plugin' ? ' [plugin]' : ''
    const ownsRu = found[ns].ru !== undefined

    if (ownsRu) {
      console.log(ours === undefined
        ? `OWN-RU    ${ns}${tag}: the plugin ships its own ru dictionary — nothing to translate here`
        : `OWN-RU    ${ns}${tag}: the plugin ships its own ru dictionary — delete ${localDirOf(ns)}/${ns}.json`)
      continue
    }
    if (!ours) {
      console.log(`NEW       ${ns}${tag}: ${shipped.length} keys — namespace is not translated yet`)
      missingKeys += shipped.length
      if (draftsDir !== undefined) {
        drafts[ns] = Object.fromEntries(shipped.map((key) => [key, { en: found[ns].en[key], ru: '' }]))
      }
      continue
    }
    const missing = shipped.filter((k) => !(k in ours))
    const removed = Object.keys(ours).filter((k) => !shipped.includes(k))
    missingKeys += missing.length
    removedKeys += removed.length
    if (missing.length) console.log(`MISSING   ${ns}${tag}: ${missing.length} — ${missing.slice(0, 6).join(', ')}${missing.length > 6 ? ', …' : ''}`)
    if (removed.length) console.log(`REMOVED   ${ns}${tag}: ${removed.length} — ${removed.slice(0, 6).join(', ')}${removed.length > 6 ? ', …' : ''}`)
    if (!missing.length && !removed.length) console.log(`OK        ${ns}${tag}: ${shipped.length}`)
    if (missing.length && draftsDir !== undefined) {
      drafts[ns] = Object.fromEntries(missing.map((key) => [key, { en: found[ns].en[key], ru: '' }]))
    }
  }

  for (const ns of Object.keys(local).sort()) {
    if (!(ns in found)) console.log(`UNUSED    ${ns}: namespace no longer ships in any installed bundle (${localDirOf(ns)})`)
  }

  if (draftsDir !== undefined) {
    fs.mkdirSync(draftsDir, { recursive: true })
    for (const [ns, entries] of Object.entries(drafts)) {
      fs.writeFileSync(path.join(draftsDir, `${ns}.json`), JSON.stringify(entries, null, 2) + '\n')
      draftFiles++
    }
    if (draftFiles) console.log(`\ndrafts written to ${path.relative(root, draftsDir)} (${draftFiles} files) — fill in "ru" and move them into src/locales[/plugins]`)
  }

  const total = Object.values(found).reduce((n, locales) => n + Object.keys(locales.en ?? {}).length, 0)
  console.log(`\ncore namespaces: ${Object.keys(coreFound).length}; plugin namespaces: ${Object.keys(pluginFound).length}`)
  console.log(`shipped keys: ${total}; missing: ${missingKeys}; removed: ${removedKeys}`)
  process.exit(missingKeys ? 1 : 0)
}
