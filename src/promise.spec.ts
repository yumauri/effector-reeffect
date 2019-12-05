import { cancel, wrap } from './promise'
import { CancelledError } from './error'

test('wrap not promise', () => {
  expect.assertions(1)
  return wrap('test' as any).then(result => expect(result).toBe('test'))
})

test('wrap resolved promise', () => {
  expect.assertions(1)
  return wrap(Promise.resolve('test')).then(result =>
    expect(result).toBe('test')
  )
})

test('cancel wrapped promise', () => {
  expect.assertions(3)

  const promise = new Promise(resolve => setImmediate(() => resolve('test')))
  const wrapped = wrap(promise)

  expect(cancel in wrapped).toBe(true)
  expect(typeof wrapped[cancel] === 'function').toBe(true)

  wrapped[cancel]()

  return wrapped.catch(error =>
    expect(error instanceof CancelledError).toBe(true)
  )
})

test('cancel wrapped promise logic', () => {
  expect.assertions(4)

  const promise = new Promise(resolve => setImmediate(() => resolve('test')))
  promise[cancel] = jest.fn()
  const wrapped = wrap(promise)

  expect(cancel in wrapped).toBe(true)
  expect(typeof wrapped[cancel] === 'function').toBe(true)

  wrapped[cancel]()

  return wrapped.catch(error => {
    expect(error instanceof CancelledError).toBe(true)
    expect(promise[cancel]).toHaveBeenCalled()
  })
})
