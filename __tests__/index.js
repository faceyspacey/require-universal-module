// @noflow
import path from 'path'
import req, { tryRequire, findExport, requireById } from '../src'
import { flushModuleIds, flushChunkNames } from '../server'
import { createPath, waitFor, normalizePath } from '../__test-helpers__'


describe('requireSync', () => {
  it('babel', () => {
    const modulePath = createPath('es6')
    const { mod } = req(undefined, { path: modulePath })

    const defaultExport = require(modulePath).default
    expect(mod).toEqual(defaultExport)
  })

  it('webpack', () => {
    global.__webpack_require__ = path => __webpack_modules__[path]
    const modulePath = createPath('es6')

    global.__webpack_modules__ = {
      [modulePath]: require(modulePath)
    }

    const { mod } = req(undefined, { resolve: modulePath })

    const defaultExport = require(modulePath).default
    expect(mod).toEqual(defaultExport)

    delete global.__webpack_require__
    delete global.__webpack_modules__
  })

  it('webpack: resolve option as string', () => {
    global.__webpack_require__ = path => __webpack_modules__[path]
    const modulePath = createPath('es6.js')

    global.__webpack_modules__ = {
      [modulePath]: require(modulePath)
    }

    const { mod } = req(undefined, { resolve: modulePath })

    const defaultExport = require(modulePath).default
    expect(mod).toEqual(defaultExport)

    delete global.__webpack_require__
    delete global.__webpack_modules__
  })

  it('webpack: when mod is undefined, requireSync used instead after all chunks evaluated', () => {
    global.__webpack_require__ = path => __webpack_modules__[path]
    const modulePath = createPath('es6')

    // main.js chunk is evaluated, but 0.js comes after
    global.__webpack_modules__ = {}

    const { requireSync, mod } = req(undefined, {
      resolve: () => modulePath
    })

    expect(mod).toEqual(undefined)

    // 0.js chunk is evaluated, and now the module exists
    global.__webpack_modules__ = {
      [modulePath]: require(modulePath)
    }

    // requireSync is used, for example, at render time after all chunks are evaluated
    const modAttempt2 = requireSync()
    const defaultExport = require(modulePath).default
    expect(modAttempt2).toEqual(defaultExport)

    delete global.__webpack_require__
    delete global.__webpack_modules__
  })

  it('es5 resolution', () => {
    const { mod } = req(undefined, {
      path: path.join(__dirname, '../__fixtures__/es5')
    })

    const defaultExport = require('../__fixtures__/es5')
    expect(mod).toEqual(defaultExport)
  })
})

describe('requireAsync', () => {
  it('return Promise.resolve(mod) if module already synchronously required', async () => {
    const modulePath = createPath('es6')
    const { requireAsync, mod } = req(undefined, { path: modulePath })

    expect(mod).toBeDefined()

    const prom = requireAsync()
    expect(prom.then).toBeDefined()

    const modAgain = await requireAsync()
    expect(modAgain).toEqual('hello')
  })

  it('() => import()', async () => {
    const { requireAsync } = req(() => Promise.resolve('hurray'))

    const res = await requireAsync()
    expect(res).toEqual('hurray')
  })

  it('import()', async () => {
    const { requireAsync } = req(Promise.resolve('hurray'))

    const res = await requireAsync()
    expect(res).toEqual('hurray')
  })

  it('(cb) => cb(null, "hurray")', async () => {
    const { requireAsync } = req(cb => cb(null, 'hurray'))

    const res = await requireAsync()
    expect(res).toEqual('hurray')
  })

  it('(cb) => cb("ah")', async () => {
    const { requireAsync } = req(cb => cb(new Error('ah')))

    try {
      await requireAsync()
    }
    catch (error) {
      expect(error.message).toEqual('ah')
    }
  })

  it('export not found rejects', async () => {
    const { requireAsync } = req(() => Promise.resolve('hurray'), {
      key: 'dog'
    })

    try {
      await requireAsync()
    }
    catch (error) {
      expect(error.message).toEqual('export not found')
    }
  })

  it('rejected promise', async () => {
    const { requireAsync } = req(Promise.reject(new Error('ah')))

    try {
      await requireAsync()
    }
    catch (error) {
      expect(error.message).toEqual('ah')
    }
  })
})


describe('addModule', () => {
  it('babel', () => {
    flushModuleIds() // insure sets are empty:
    flushChunkNames()

    const moduleEs6 = createPath('es6')
    const moduleEs5 = createPath('es5')

    let universal = req(undefined, { path: moduleEs6, chunkName: 'es6' })
    universal.addModule()

    universal = req(undefined, { path: moduleEs5, chunkName: 'es5' })
    universal.addModule()

    const paths = flushModuleIds().map(normalizePath)
    const chunkNames = flushChunkNames()

    expect(paths).toEqual(['/es6', '/es5'])
    expect(chunkNames).toEqual(['es6', 'es5'])
  })

  it('webpack', () => {
    global.__webpack_require__ = path => __webpack_modules__[path]

    const moduleEs6 = createPath('es6')
    const moduleEs5 = createPath('es5')

    // modules stored by paths instead of IDs (replicates babel implementation)
    global.__webpack_modules__ = {
      [moduleEs6]: require(moduleEs6),
      [moduleEs5]: require(moduleEs5)
    }

    flushModuleIds() // insure sets are empty:
    flushChunkNames()

    let universal = req(undefined, { resolve: () => moduleEs6, chunkName: 'es6' })
    universal.addModule()

    universal = req(undefined, { resolve: () => moduleEs5, chunkName: 'es5' })
    universal.addModule()

    const paths = flushModuleIds().map(normalizePath)
    const chunkNames = flushChunkNames()

    expect(paths).toEqual(['/es6', '/es5'])
    expect(chunkNames).toEqual(['es6', 'es5'])

    delete global.__webpack_require__
    delete global.__webpack_modules__
  })
})


describe('options', () => {
  it('key (string): resolve export to value of key', () => {
    const modulePath = createPath('es6')
    const { mod } = req(undefined, {
      path: modulePath,
      key: 'foo'
    })

    const defaultExport = require(modulePath).foo
    expect(mod).toEqual(defaultExport)
  })

  it('key (function): resolves export to function return', () => {
    const modulePath = createPath('es6')
    const { mod } = req(undefined, {
      path: modulePath,
      key: module => module.foo
    })

    const defaultExport = require(modulePath).foo
    expect(mod).toEqual(defaultExport)
  })

  it('key (null): resolves export to be entire module', () => {
    const modulePath = createPath('es6')
    const { mod } = req(undefined, {
      path: path.join(__dirname, '../__fixtures__/es6'),
      key: null
    })

    const defaultExport = require('../__fixtures__/es6')
    expect(mod).toEqual(defaultExport)
  })

  it('timeout', async () => {
    const importAsync = waitFor(20).then('hurray')
    const { requireAsync } = req(importAsync, { timeout: 10 })

    try {
      await requireAsync()
    }
    catch (error) {
      expect(error.message).toEqual('timeout exceeded')
    }
  })

  it('onLoad (async): is called and passed entire module', async () => {
    const onLoad = jest.fn()
    const mod = { __esModule: true, default: 'foo' }
    const importAsync = Promise.resolve(mod)
    const { requireAsync } = req(() => importAsync, {
      onLoad,
      key: 'default'
    })

    await requireAsync()

    expect(onLoad).toBeCalledWith(mod)
    expect(onLoad).not.toBeCalledWith('foo')
  })

  it('onLoad (sync): is called and passed entire module', async () => {
    const onLoad = jest.fn()
    const modulePath = createPath('es6')
    const mod = require(modulePath)
    const importAsync = Promise.resolve(mod)
    const { requireAsync } = req(importAsync, {
      onLoad,
      key: 'default',
      path: modulePath
    })

    expect(onLoad).toBeCalledWith(mod)
    expect(onLoad).not.toBeCalledWith('foo')
  })
})


describe('unit tests', () => {
  test('tryRequire', () => {
    const moduleEs6 = createPath('es6')
    const expectedModule = require(moduleEs6)

    // babel
    let mod = tryRequire(moduleEs6)
    expect(mod).toEqual('hello')

    // webpack
    global.__webpack_require__ = path => __webpack_modules__[path]
    global.__webpack_modules__ = {
      [moduleEs6]: expectedModule
    }

    const onLoad = jest.fn()
    mod = tryRequire(moduleEs6, 'foo', onLoad)
    expect(mod).toEqual('bar')
    expect(onLoad).toBeCalledWith(expectedModule)

    delete global.__webpack_require__
    delete global.__webpack_modules__

    // module not found
    mod = tryRequire('/foo')
    expect(mod).toEqual(null)
  })

  test('requireById', () => {
    const moduleEs6 = createPath('es6')
    const expectedModule = require(moduleEs6)

    // babel
    let mod = requireById(moduleEs6)
    expect(mod).toEqual(expectedModule)

    // webpack
    global.__webpack_require__ = path => __webpack_modules__[path]
    global.__webpack_modules__ = {
      [moduleEs6]: expectedModule
    }

    mod = requireById(moduleEs6)
    expect(mod).toEqual(expectedModule)

    delete global.__webpack_require__
    delete global.__webpack_modules__

    // module not found
    expect(() => requireById('/foo')).toThrow()
  })

  test('findExport', () => {
    const mod = { foo: 'bar' }

    // key as string
    let exp = findExport(mod, 'foo')
    expect(exp).toEqual('bar')

    // key as function
    exp = findExport(mod, mod => mod.foo)
    expect(exp).toEqual('bar')

    // key as null
    exp = findExport(mod, null)
    expect(exp).toEqual(mod)

    // default: no key
    exp = findExport({ __esModule: true, default: 'baz' })
    expect(exp).toEqual('baz')
  })
})
