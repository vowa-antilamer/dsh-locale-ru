import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

import { readDictionaries } from '../scripts/build.mjs'
import { PLUGIN_DIR, SKIP_NAMESPACES, scanClientBundles } from '../scripts/extract-dictionaries.mjs'

/** The node_modules of the profile this checkout is installed into, when there is one. */
const profileModules = process.env.DSH_PROFILE_DIR
  ? path.join(process.env.DSH_PROFILE_DIR, 'node_modules')
  : undefined
const installed = profileModules !== undefined && fs.existsSync(profileModules)

test('plugin dictionaries live in their own directory and never shadow a core namespace', () => {
  const { pairs, pluginPairs } = readDictionaries()
  assert.ok(fs.existsSync(PLUGIN_DIR), 'src/locales/plugins must exist')
  for (const ns of Object.keys(pluginPairs)) {
    assert.equal(ns in pairs, false, `${ns} is declared as both a core and a plugin dictionary`)
  }
})

test('every namespace an installed plugin registers has a dictionary', async (t) => {
  if (!installed) return t.skip('no profile node_modules in this environment')
  const found = scanClientBundles(profileModules)
  const { pairs, pluginPairs } = readDictionaries()
  const untranslated = Object.keys(found).filter(
    (ns) => !(ns in pairs) && !(ns in pluginPairs) && !SKIP_NAMESPACES.has(ns) && Object.keys(found[ns].en ?? {}).length > 0,
  )
  assert.deepEqual(
    untranslated,
    [],
    'an installed plugin registers an untranslated namespace: run scripts/extract-dictionaries.mjs --drafts and add the translation to src/locales/plugins',
  )
})

test('a plugin dictionary covers exactly the keys the installed plugin ships', async (t) => {
  if (!installed) return t.skip('no profile node_modules in this environment')
  const found = scanClientBundles(profileModules)
  const { pluginPairs } = readDictionaries()
  let checked = 0
  for (const [ns, entries] of Object.entries(pluginPairs)) {
    const shipped = found[ns]?.en
    if (shipped === undefined) continue // the plugin is not installed here
    checked++
    assert.deepEqual(
      Object.keys(entries).sort(),
      Object.keys(shipped).sort(),
      `${ns}: the dictionary drifted from the installed plugin (re-run scripts/extract-dictionaries.mjs)`,
    )
    for (const [key, { en }] of Object.entries(entries)) {
      assert.equal(en, shipped[key], `${ns} / ${key}: the English source drifted from the installed plugin`)
    }
  }
  if (checked === 0) t.skip('none of the translated plugins is installed here')
})

test('no dictionary claims a namespace the plugin already translates itself', async (t) => {
  if (!installed) return t.skip('no profile node_modules in this environment')
  const found = scanClientBundles(profileModules)
  const { pluginPairs } = readDictionaries()
  for (const ns of Object.keys(pluginPairs)) {
    if (found[ns]?.ru === undefined) continue
    assert.fail(`${ns}: the installed plugin ships its own ru dictionary — delete src/locales/plugins/${ns}.json`)
  }
})
