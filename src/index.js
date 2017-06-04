// @flow
declare var __webpack_require__: Function;
declare var __webpack_modules__: Object;

type ImportAsync = Promise<*> | () => Promise<*>
type Id = string | number
type FindExport = string | null | (module: Object) => any
type OnLoad = (module: Object) => void

type Options = {
  resolve: string | () => Id,
  chunkName?: string,
  path?: string,
  key?: FindExport,
  timeout?: number,
  onLoad?: OnLoad
}

const CHUNK_NAMES = new Set()
const MODULE_IDS = new Set()

const IS_TEST = process.env.NODE_ENV === 'test'
const isServer = typeof window === 'undefined' || IS_TEST
const isWebpack = () => typeof __webpack_require__ !== 'undefined'
const babelInterop = obj => obj && obj.__esModule ? obj.default : obj

const findExport = (mod: Object, key?: FindExport) => {
  if (typeof key === 'function') {
    return key(mod)
  }
  else if (key === null) {
    return mod
  }

  return key ? mod[key] : babelInterop(mod)
}

const tryRequire = (id: Id, key?: FindExport, onLoad?: OnLoad) => {
  try {
    const mod = requireById(id)

    if (onLoad) {
      onLoad(mod)
    }

    return findExport(mod, key)
  }
  catch (err) {}

  return null
}

const requireById = (id: Id) => {
  if (!isWebpack() && typeof id === 'string') {
    return module.require(id)
  }

  return __webpack_require__(id)
}

export default (importAsync: ImportAsync, options: Options) => {
  const {
    resolve,
    chunkName,
    path,
    key,
    timeout = 15000,
    onLoad
  } = options

  let mod
  let weakId
  let prom
  let timer

  const requireSync = () => {
    if (!mod) {
      if (!isWebpack() && path) {
        mod = tryRequire(path, key, onLoad)
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

  const requireAsync = () => {
    if (mod) {
      return Promise.resolve(mod)
    }

    if (!prom) {
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

        const request = typeof importAsync === 'function'
          ? importAsync(resolveImport)
          : importAsync

        // if importAsync doesn't return a promise, it must call resolveImport
        // itself. Most common is the promise implementation below.
        if (!request || !request.then) {
          return
        }

        request
          .then(m => resolveImport(null, m))
          .catch(error => {
            clearTimeout(timer)
            reject(error)
          })
      })
    }

    return prom
  }

  const addModule = () => {
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
        MODULE_IDS.add(path)
      }
    }
  }

  return {
    requireSync,
    requireAsync,
    addModule,
    mod: requireSync()
  }
}

export const flushChunkNames = () => {
  const chunks = Array.from(CHUNK_NAMES)
  CHUNK_NAMES.clear()
  return chunks
}

export const flushModuleIds = () => {
  const ids = Array.from(MODULE_IDS)
  MODULE_IDS.clear()
  return ids
}
