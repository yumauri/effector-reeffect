import { createDomain, createEvent, forward, is } from 'effector'
import { createReEffectFactory } from './createReEffect'
import { TAKE_EVERY, TAKE_FIRST, TAKE_LAST } from './strategy'
import { CancelledError, LimitExceededError } from './error'

console.error = jest.fn()

test('createReEffectFactory should be factory', () => {
  expect(typeof createReEffectFactory()).toBe('function')
  const createEvent = createDomain().createEvent
  expect(typeof createReEffectFactory(createEvent)).toBe('function')
})

test('createReEffect should create Effect-like object', () => {
  const createReEffect = createReEffectFactory()
  const reeffect = createReEffect<void, void>('test')

  expect(is.effect(reeffect)).toBe(true)
  expect(reeffect.shortName).toBe('test')
  expect(typeof reeffect.use).toBe('function')
  expect(typeof reeffect.watch).toBe('function')
  expect(typeof reeffect.prepend).toBe('function')

  expect(is.event(reeffect.done)).toBe(true)
  expect(is.event(reeffect.fail)).toBe(true)
  expect(is.event(reeffect.finally)).toBe(true)
  expect(is.store(reeffect.pending)).toBe(true)

  // additional properties
  expect(is.event(reeffect.cancelled)).toBe(true)
  expect(is.event(reeffect.cancel)).toBe(true)

  // reeffect should return promise
  expect(reeffect() instanceof Promise).toBe(true)
})

test('createReEffect single successful operation', async () => {
  expect.assertions(4)
  const fn = jest.fn()

  const createReEffect = createReEffectFactory()
  const reeffect = createReEffect<void, string>({
    async handler() {
      return new Promise<string>(resolve => setImmediate(() => resolve('test')))
    },
  })

  reeffect.done.watch(fn)
  reeffect.fail.watch(fn)
  reeffect.cancelled.watch(fn)
  reeffect.finally.watch(fn)

  const result = await reeffect()
  expect(result).toBe('test')

  expect(fn).toHaveBeenCalledTimes(2)

  // done event
  expect(fn.mock.calls[0][0]).toEqual({
    params: undefined,
    strategy: TAKE_EVERY,
    result: 'test',
  })

  // finally event
  expect(fn.mock.calls[1][0]).toEqual({
    params: undefined,
    strategy: TAKE_EVERY,
    result: 'test',
    status: 'done',
  })
})

test('createReEffect single failed operation', async () => {
  expect.assertions(4)
  const fn = jest.fn()

  const createReEffect = createReEffectFactory()
  const reeffect = createReEffect<number, string>({
    async handler() {
      return new Promise<string>((_, reject) =>
        setImmediate(() => reject('error'))
      )
    },
  })

  reeffect.done.watch(fn)
  reeffect.fail.watch(fn)
  reeffect.cancelled.watch(fn)
  reeffect.finally.watch(fn)

  try {
    await reeffect(42)
  } catch (error) {
    expect(error).toBe('error')
  }

  expect(fn).toHaveBeenCalledTimes(2)

  // fail event
  expect(fn.mock.calls[0][0]).toEqual({
    params: 42,
    strategy: TAKE_EVERY,
    error: 'error',
  })

  // finally event
  expect(fn.mock.calls[1][0]).toEqual({
    params: 42,
    strategy: TAKE_EVERY,
    error: 'error',
    status: 'fail',
  })
})

test('createReEffect with TAKE_EVERY strategy', async () => {
  expect.assertions(7)
  const fn = jest.fn()

  const createReEffect = createReEffectFactory()
  const reeffect = createReEffect<number, string>({
    async handler(params) {
      return new Promise<string>(resolve =>
        setImmediate(() => resolve(`test${params}`))
      )
    },
  })

  reeffect.done.watch(fn)
  reeffect.fail.watch(fn)
  reeffect.cancelled.watch(fn)
  reeffect.finally.watch(fn)
  reeffect.pending.watch(fn)

  const result = await Promise.all([reeffect(11), reeffect(22)])
  expect(result).toEqual(['test11', 'test22'])

  expect(fn).toHaveBeenCalledTimes(5)

  // pending
  expect(fn.mock.calls[0][0]).toEqual(false)
  expect(fn.mock.calls[1][0]).toEqual(true)

  // done event
  expect(fn.mock.calls[2][0]).toEqual({
    params: 22,
    strategy: TAKE_EVERY,
    result: 'test22',
  })

  // finally event
  expect(fn.mock.calls[3][0]).toEqual({
    params: 22,
    strategy: TAKE_EVERY,
    result: 'test22',
    status: 'done',
  })

  // pending
  expect(fn.mock.calls[4][0]).toEqual(false)
})

test('createReEffect with TAKE_EVERY strategy with first one failed', async () => {
  expect.assertions(7)
  const fn = jest.fn()

  const createReEffect = createReEffectFactory()
  const reeffect = createReEffect<number, string>({
    async handler(params) {
      return new Promise<string>((resolve, reject) =>
        setTimeout(
          () =>
            params === 11
              ? reject(`reject${params}`)
              : resolve(`resolve${params}`),
          params
        )
      )
    },
  })

  reeffect.done.watch(fn)
  reeffect.fail.watch(fn)
  reeffect.cancelled.watch(fn)
  reeffect.finally.watch(fn)
  reeffect.pending.watch(fn)

  const result = await Promise.all([
    reeffect(11).catch(error => error),
    reeffect(22),
  ])
  expect(result).toEqual(['reject11', 'resolve22'])

  expect(fn).toHaveBeenCalledTimes(5)

  // pending
  expect(fn.mock.calls[0][0]).toEqual(false)
  expect(fn.mock.calls[1][0]).toEqual(true)

  // done event
  expect(fn.mock.calls[2][0]).toEqual({
    params: 22,
    strategy: TAKE_EVERY,
    result: 'resolve22',
  })

  // finally event
  expect(fn.mock.calls[3][0]).toEqual({
    params: 22,
    strategy: TAKE_EVERY,
    result: 'resolve22',
    status: 'done',
  })

  // pending
  expect(fn.mock.calls[4][0]).toEqual(false)
})

test('createReEffect with TAKE_FIRST strategy', async () => {
  expect.assertions(8)
  const fn = jest.fn()

  const createReEffect = createReEffectFactory()
  const reeffect = createReEffect<number, string>({
    strategy: TAKE_FIRST,
    async handler(params) {
      return new Promise<string>(resolve =>
        setImmediate(() => resolve(`test${params}`))
      )
    },
  })

  reeffect.done.watch(fn)
  reeffect.fail.watch(fn)
  reeffect.cancelled.watch(fn)
  reeffect.finally.watch(fn)
  reeffect.pending.watch(fn)

  const result = await Promise.all([
    reeffect(11),
    reeffect(22).catch(error => error),
  ])
  expect(result).toEqual(['test11', expect.any(CancelledError)])

  expect(fn).toHaveBeenCalledTimes(6)

  // pending
  expect(fn.mock.calls[0][0]).toEqual(false)
  expect(fn.mock.calls[1][0]).toEqual(true)

  // cancelled event
  expect(fn.mock.calls[2][0]).toEqual({
    params: 22,
    strategy: TAKE_FIRST,
    error: expect.any(CancelledError),
  })

  // done event
  expect(fn.mock.calls[3][0]).toEqual({
    params: 11,
    strategy: TAKE_FIRST,
    result: 'test11',
  })

  // finally event
  expect(fn.mock.calls[4][0]).toEqual({
    params: 11,
    strategy: TAKE_FIRST,
    result: 'test11',
    status: 'done',
  })

  // pending
  expect(fn.mock.calls[5][0]).toEqual(false)
})

test('createReEffect with TAKE_LAST strategy', async () => {
  expect.assertions(8)
  const fn = jest.fn()

  const createReEffect = createReEffectFactory()
  const reeffect = createReEffect<number, string>({
    async handler(params) {
      return new Promise<string>(resolve =>
        setImmediate(() => resolve(`test${params}`))
      )
    },
  })

  reeffect.done.watch(fn)
  reeffect.fail.watch(fn)
  reeffect.cancelled.watch(fn)
  reeffect.finally.watch(fn)
  reeffect.pending.watch(fn)

  const result = await Promise.all([
    reeffect(11).catch(error => error),
    reeffect(22, TAKE_LAST),
  ])
  expect(result).toEqual([expect.any(CancelledError), 'test22'])

  expect(fn).toHaveBeenCalledTimes(6)

  // pending
  expect(fn.mock.calls[0][0]).toEqual(false)
  expect(fn.mock.calls[1][0]).toEqual(true)

  // cancelled event
  expect(fn.mock.calls[2][0]).toEqual({
    params: 11,
    strategy: TAKE_EVERY,
    error: expect.any(CancelledError),
  })

  // done event
  expect(fn.mock.calls[3][0]).toEqual({
    params: 22,
    strategy: TAKE_LAST,
    result: 'test22',
  })

  // finally event
  expect(fn.mock.calls[4][0]).toEqual({
    params: 22,
    strategy: TAKE_LAST,
    result: 'test22',
    status: 'done',
  })

  // pending
  expect(fn.mock.calls[5][0]).toEqual(false)
})

test('createReEffect with manual cancellation', async () => {
  expect.assertions(7)
  const fn = jest.fn()

  const createReEffect = createReEffectFactory()
  const reeffect = createReEffect<number, string>({
    async handler(params) {
      return new Promise<string>(resolve =>
        setImmediate(() => resolve(`test${params}`))
      )
    },
  })

  reeffect.done.watch(fn)
  reeffect.fail.watch(fn)
  reeffect.cancelled.watch(fn)
  reeffect.finally.watch(fn)
  reeffect.pending.watch(fn)

  const running = Promise.all([
    reeffect(11).catch(error => error),
    reeffect(22).catch(error => error),
  ])
  reeffect.cancel()
  const result = await running
  expect(result).toEqual([
    expect.any(CancelledError),
    expect.any(CancelledError),
  ])

  expect(fn).toHaveBeenCalledTimes(5)

  // pending
  expect(fn.mock.calls[0][0]).toEqual(false)
  expect(fn.mock.calls[1][0]).toEqual(true)

  // cancelled event
  expect(fn.mock.calls[2][0]).toEqual({
    params: 11,
    strategy: TAKE_EVERY,
    error: expect.any(CancelledError),
  })

  // cancelled event
  expect(fn.mock.calls[3][0]).toEqual({
    params: 22,
    strategy: TAKE_EVERY,
    error: expect.any(CancelledError),
  })

  // pending
  expect(fn.mock.calls[4][0]).toEqual(false)
})

test('createReEffect with logic cancel callback', async () => {
  expect.assertions(3)
  const fn = jest.fn()

  const createReEffect = createReEffectFactory()
  const reeffect = createReEffect<number, string>({
    async handler(params, onCancel) {
      let timeout
      onCancel(() => clearTimeout(timeout))
      return new Promise<string>(resolve => {
        timeout = setTimeout(() => {
          fn(`logic${params}`)
          resolve(`test${params}`)
        }, 1)
      })
    },
  })

  const result = await Promise.all([
    reeffect(11).catch(error => error),
    reeffect(22, TAKE_LAST),
  ])
  expect(result).toEqual([expect.any(CancelledError), 'test22'])
  expect(fn).toHaveBeenCalledTimes(1)
  expect(fn.mock.calls[0][0]).toEqual('logic22')
})

test('createReEffect with limit', async () => {
  expect.assertions(1)

  const createReEffect = createReEffectFactory()
  const reeffect = createReEffect<number, string>({
    limit: 1,
    handler: () =>
      new Promise<string>(resolve => setImmediate(() => resolve('test'))),
  })

  const result = await Promise.all([
    reeffect(11),
    reeffect(22).catch(error => error),
  ])
  expect(result).toEqual(['test', expect.any(LimitExceededError)])
})

test('createReEffect use should change handler', async () => {
  expect.assertions(4)

  const handler1 = () =>
    new Promise<string>(resolve => setImmediate(() => resolve('handler1')))
  const handler2 = () =>
    new Promise<string>(resolve => setImmediate(() => resolve('handler2')))

  const createReEffect = createReEffectFactory()
  const reeffect = createReEffect<number, string>({ handler: handler1 })

  expect(reeffect.use.getCurrent()).toBe(handler1)
  expect(reeffect.use(handler2)).toBe(reeffect)
  expect(reeffect.use.getCurrent()).toBe(handler2)

  const result = await Promise.all([
    reeffect(11),
    reeffect(22, TAKE_FIRST).catch(error => error),
  ])
  expect(result).toEqual(['handler2', expect.any(CancelledError)])
})

test('synchronious exception in handler should reject operation', () => {
  expect.assertions(1)

  const createReEffect = createReEffectFactory()
  const reeffect = createReEffect<void, void>()
  reeffect.use(() => {
    throw 'error' // tslint:disable-line no-string-throw
  })

  return reeffect().catch(error => expect(error).toBe('error'))
})

test('createReEffect with Effector API, success', async () => {
  expect.assertions(3)
  const fn = jest.fn()

  const createReEffect = createReEffectFactory()
  const reeffect = createReEffect<void, string>({
    async handler() {
      return new Promise<string>(resolve => setImmediate(() => resolve('test')))
    },
  })

  reeffect.done.watch(fn)
  reeffect.fail.watch(fn)
  reeffect.cancelled.watch(fn)
  reeffect.finally.watch(fn)

  const event = createEvent()
  forward({
    from: event,
    to: reeffect,
  })
  event()

  await new Promise(resolve => setTimeout(resolve, 1))

  expect(fn).toHaveBeenCalledTimes(2)

  // done event
  expect(fn.mock.calls[0][0]).toEqual({
    params: undefined,
    strategy: TAKE_EVERY,
    result: 'test',
  })

  // finally event
  expect(fn.mock.calls[1][0]).toEqual({
    params: undefined,
    strategy: TAKE_EVERY,
    result: 'test',
    status: 'done',
  })
})

test('createReEffect with Effector API, failure', async () => {
  expect.assertions(3)
  const fn = jest.fn()

  const createReEffect = createReEffectFactory()
  const reeffect = createReEffect<void, string>({
    async handler() {
      return new Promise<string>((_, reject) =>
        setImmediate(() => reject('test'))
      )
    },
  })

  reeffect.done.watch(fn)
  reeffect.fail.watch(fn)
  reeffect.cancelled.watch(fn)
  reeffect.finally.watch(fn)

  const event = createEvent()
  forward({
    from: event,
    to: reeffect,
  })
  event()

  await new Promise(resolve => setTimeout(resolve, 1))

  expect(fn).toHaveBeenCalledTimes(2)

  // done event
  expect(fn.mock.calls[0][0]).toEqual({
    params: undefined,
    strategy: TAKE_EVERY,
    error: 'test',
  })

  // finally event
  expect(fn.mock.calls[1][0]).toEqual({
    params: undefined,
    strategy: TAKE_EVERY,
    error: 'test',
    status: 'fail',
  })
})
