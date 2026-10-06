import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { LANGUAGE, PACKAGE_NAME, readDictionaries } from '../scripts/build.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const clientPath = path.join(root, 'lib/client.js')

/** Let the deferred plugin-dictionary task run. */
const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

/**
 * Load the generated browser module in Node and run it against a stub locale service.
 * @param ownDictionaries - namespaces a plugin already registered its own ru dictionary for.
 */
async function loadPack(ownDictionaries = {}) {
  let loaded
  const store = new Map()
  globalThis.window = {
    localStorage: {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, String(value)),
    },
    __ModuleLoader__: {
      load(record) {
        loaded = record
      },
    },
  }

  await import(`${pathToFileURL(clientPath).href}?t=${Date.now()}`)
  assert.ok(loaded, 'the module loader was never called')
  assert.equal(loaded.id, PACKAGE_NAME)

  const plugin = loaded.factory(() => {
    throw new Error('a language pack must not require other client modules')
  })

  const languages = []
  const dicts = new Map(Object.entries(ownDictionaries))
  const effects = new Set()
  const disposers = []
  const selected = []
  const ctx = {
    effect(callback, label) {
      assert.equal(typeof label, 'string')
      assert.ok(!effects.has(label), `duplicate effect label: ${label}`)
      effects.add(label)
      const dispose = callback()
      assert.equal(typeof dispose, 'function', `effect "${label}" did not return a disposer`)
      disposers.push(dispose)
      return dispose
    },
    locale: {
      addLanguage(input) {
        languages.push(input)
        return () => {}
      },
      register(ns, locale, dict) {
        assert.equal(locale, LANGUAGE.id)
        if (dicts.has(ns)) throw new Error(`locale namespace "${ns}" already has locale "${locale}"`)
        dicts.set(ns, dict)
        return () => {
          if (dicts.get(ns) === dict) dicts.delete(ns)
        }
      },
      getSnapshot: () => ({ active: 'en', locales: [], revision: 0 }),
      setLocale: (id) => selected.push(id),
    },
  }

  plugin.apply(ctx)
  return { plugin, languages, dicts, effects, disposers, selected, store }
}

test('the client module registers the Russian language', async () => {
  const { plugin, languages } = await loadPack()
  assert.deepEqual(plugin.inject, ['locale'])
  assert.deepEqual(languages, [{ id: 'ru', label: 'Русский', fallback: 'en' }])
})

test('the client module auto-selects Russian exactly once', async () => {
  const { selected, store } = await loadPack()
  assert.deepEqual(selected, ['ru'])
  assert.equal(store.get('locale-ru:auto-selected'), '1')
})

test('core namespaces register synchronously, plugin namespaces one task later', async () => {
  const { dicts } = await loadPack()
  const { dicts: core, pluginDicts } = readDictionaries()
  assert.ok(Object.keys(pluginDicts).length > 0, 'expected at least one plugin dictionary')

  assert.deepEqual([...dicts.keys()].sort(), Object.keys(core).sort(), 'core dictionaries must be live right after apply')
  for (const ns of Object.keys(pluginDicts)) {
    assert.equal(dicts.has(ns), false, `${ns} must not take part in the synchronous pass`)
  }

  await tick()
  assert.deepEqual([...dicts.keys()].sort(), [...Object.keys(core), ...Object.keys(pluginDicts)].sort())
})

test('a plugin that ships its own ru dictionary keeps ownership of its namespace', async () => {
  const own = { pet: { 'pet.feed': 'Покормить' } }
  const { dicts } = await loadPack(own)
  await tick()
  assert.deepEqual(dicts.get('pet'), own.pet, 'the plugin dictionary must survive our deferred pass')
})

test('every source namespace reaches the browser module', async () => {
  const { dicts } = await loadPack()
  await tick()
  const { dicts: core, pluginDicts } = readDictionaries()
  const source = { ...core, ...pluginDicts }
  assert.deepEqual([...dicts.keys()].sort(), Object.keys(source).sort())
  assert.ok(dicts.size >= 50, `expected the shipped namespaces, got ${dicts.size}`)
})

test('every translation keeps the English key set, placeholders and emptiness rules', async () => {
  const { dicts } = await loadPack()
  await tick()
  const { pairs: corePairs, keys, pluginPairs, pluginKeys } = readDictionaries()
  let count = 0
  for (const [ns, pairs] of Object.entries({ ...corePairs, ...pluginPairs })) {
    const built = dicts.get(ns)
    assert.deepEqual(Object.keys(built).sort(), Object.keys(pairs).sort(), `${ns}: key sets differ`)
    for (const [key, { en }] of Object.entries(pairs)) {
      const ru = built[key]
      count++
      const placeholders = (value) => (value.match(/\{[A-Za-z0-9_]+\}/g) ?? []).sort().join(',')
      assert.equal(placeholders(ru), placeholders(en), `${ns} / ${key}: placeholder mismatch`)
      assert.equal(ru.startsWith(' '), en.startsWith(' '), `${ns} / ${key}: leading space`)
      assert.equal(ru.endsWith(' '), en.endsWith(' '), `${ns} / ${key}: trailing space`)
      assert.ok(ru.trim() !== '' || en.trim() === '', `${ns} / ${key}: empty translation`)
      assert.ok(!/[\u200b\u200c\u200d\ufeff]/u.test(ru), `${ns} / ${key}: zero-width character`)
    }
  }
  assert.equal(count, keys + pluginKeys)
  assert.ok(count > 3600, `expected the full dictionary, got ${count}`)
})

test('disposing the pack releases every registered namespace', async () => {
  const { dicts, disposers } = await loadPack()
  await tick()
  assert.ok(dicts.size > 0)
  for (const dispose of disposers) dispose()
  assert.equal(dicts.size, 0)
})
