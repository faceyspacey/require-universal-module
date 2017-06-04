import requireUniversalModule from '../src'

test('first', () => {
  const { requireSync, requireAsync, addModule, mod } = requireUniversalModule(
    () => Promise.resolve(null),
    {}
  )

  expect(mod).toBeFalsy()
})
