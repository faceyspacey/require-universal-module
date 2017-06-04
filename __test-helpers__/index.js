import path from 'path'

export const createPath = name => path.join(__dirname, '../__fixtures__', name)

// fake delay so we can test different stages of async loading lifecycle
export const waitFor = ms => new Promise(resolve => setTimeout(resolve, ms))

// normalize the required path so tests pass in all environments
export const normalizePath = path => path.split('__fixtures__')[1]
