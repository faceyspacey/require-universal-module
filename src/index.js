// @flow
declare var __webpack_require__: Function
declare var __webpack_modules__: Object

export type ResolveImport = (error: ?any, module: ?any) => void
export type AsyncFunc = (ResolveImport, ...args: Array<any>) => Promise<*>
export type AsyncImport = Promise<*> | AsyncFunc
export type Id = string
export type Key = string | null | ((module: ?Object) => any)
export type OnLoad = (module: Object) => void
export type OnError = (error: Object) => void
export type PathResolve = Id | (() => Id)
export type Options = {
  resolve?: PathResolve, // only optional when async-only
  chunkName?: string,
  path?: PathResolve,
  key?: Key,
  timeout?: number,
  onError?: OnError,
  onLoad?: OnLoad,
  initialRequire?: boolean,
  alwaysUpdate?: boolean
}

export type RequireAsync = (...args: Array<any>) => Promise<?any>
export type RequireSync = () => ?any
export type AddModule = () => void
export type Mod = any

export type Tools = {
  requireAsync: RequireAsync,
  requireSync: RequireSync,
  addModule: AddModule,
  mod: ?Mod
}

export type Ids = Array<string>

const CHUNK_NAMES = new Set()
const MODULE_IDS = new Set()

const IS_TEST = process.env.NODE_ENV === 'test'
const isServer = typeof window === 'undefined' || IS_TEST
const isWebpack = () => typeof __webpack_require__ !== 'undefined'
const babelInterop = obj => (obj && obj.__esModule ? obj.default : obj)

export const tryRequire = (id: Id, key?: Key, onLoad?: OnLoad): ?any => {
  try {
    const mod = requireById(id)

    if (onLoad && mod) {
      onLoad(mod)
    }

    return findExport(mod, key)
  }
  catch (err) {}

  return null
}

export const requireById = (id: Id): ?any => {
  if (!isWebpack() && typeof id === 'string') {
    return module.require(id)
  }

  return __webpack_require__(id)
}

export const findExport = (mod: ?Object, key?: Key): ?any => {
  if (typeof key === 'function') {
    return key(mod)
  }
  else if (key === null) {
    return mod
  }

  return mod && key ? mod[key] : babelInterop(mod)
}

export default (asyncImport: ?AsyncImport, options: Options = {}): Tools => {
  const {
    resolve,
    chunkName,
    path,
    key,
    timeout = 15000,
    onLoad,
    onError,
    initialRequire = true,
    alwaysUpdate = false
  } = options

  const modulePath = typeof path === 'function' ? path() : path || ''

  let mod
  let weakId
  let prom
  let timer

  const requireSync = (): ?any => {
    if (!mod) {
      if (!isWebpack() && path) {
        mod = tryRequire(modulePath, key, onLoad)
      }
      else if (isWebpack() && resolve) {
        weakId = typeof resolve === 'string' ? resolve : resolve()

        if (__webpack_modules__[weakId]) {
          mod = tryRequire(weakId, key, onLoad)
        }
      }
    }

    return mod
  }

  const requireAsync = (...args: Array<any>): Promise<?any> => {
    if (mod && !alwaysUpdate) {
      return Promise.resolve(mod)
    }

    if (!prom || alwaysUpdate) {
      prom = new Promise((resolve, reject) => {
        if (timeout) {
          timer = setTimeout(() => {
            reject(new Error('timeout exceeded'))
          }, timeout)
        }

        const resolveImport = (error, m) => {
          clearTimeout(timer)

          if (error) {
            return reject(error)
          }

          if (onLoad && m) {
            onLoad(m)
          }

          mod = findExport(m, key)

          if (mod) {
            return resolve(mod)
          }

          reject(new Error('export not found'))
        }

        const request = typeof asyncImport === 'function'
          ? asyncImport(...args, resolveImport)
          : asyncImport

        // if asyncImport doesn't return a promise, it must call resolveImport
        // itself. Most common is the promise implementation below.
        if (!request || !request.then) {
          return
        }

        request.then(m => resolveImport(null, m)).catch(error => {
          clearTimeout(timer)
          if (onError) onError(error)
          reject(error)
        })
      })
    }

    return prom
  }

  const addModule = (): void => {
    if (isServer) {
      if (chunkName) {
        CHUNK_NAMES.add(chunkName)
      }

      // just fill both sets so `flushModuleIds` continues to work,
      // even if you decided to start providing chunk names. It's
      // a small array of 3-20 chunk names on average anyway. Users
      // can flush/clear both sets if they feel they need to.
      if (isWebpack() && weakId) {
        MODULE_IDS.add(weakId)
      }
      else if (!isWebpack() && path) {
        MODULE_IDS.add(modulePath)
      }
    }
  }

  return {
    requireSync,
    requireAsync,
    addModule,
    mod: initialRequire ? requireSync() : undefined
  }
}

export const flushChunkNames = (): Ids => {
  const chunks = Array.from(CHUNK_NAMES)
  CHUNK_NAMES.clear()
  return chunks
}

export const flushModuleIds = (): Ids => {
  const ids = Array.from(MODULE_IDS)
  MODULE_IDS.clear()
  return ids
}
