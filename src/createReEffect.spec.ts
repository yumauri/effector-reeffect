import { createDomain, createEvent, forward, is } from 'effector'
import { createReEffectFactory } from './createReEffect'
import { CancelledError, LimitExceededError } from './error'
import { QUEUE, RACE, TAKE_EVERY, TAKE_FIRST, TAKE_LAST } from './strategy'

console.error = jest.fn()

test('createReEffectFactory should be factory', () => {
  expect(typeof createReEffectFactory()).toBe('function')
  const createEffect = createDomain().createEffect
  expect(typeof createReEffectFactory(createEffect)).toBe('function')
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
      return new Promise<string>(resolve =>
        setTimeout(() => resolve('test'), 10)
      )
    },
  })

  reeffect.done.watch(fn)
  reeffect.fail.watch(fn)
  reeffect.cancelled.watch(fn)
  reeffect.finally.watch(fn)

  const result = await reeffect({ strategy: TAKE_EVERY })
  expect(result).toBe('test')

  expect(fn).toHaveBeenCalledTimes(2)

  // finally event
  expect(fn.mock.calls[0][0]).toEqual({
    params: undefined,
    result: 'test',
    status: 'done',
  })

  // done event
  expect(fn.mock.calls[1][0]).toEqual({
    params: undefined,
    result: 'test',
  })
})

test('createReEffect single sync successful operation', async () => {
  expect.assertions(4)
  const fn = jest.fn()

  const createReEffect = createReEffectFactory()
  const reeffect = createReEffect<void, string>({
    handler() {
      return 'test'
    },
  })

  reeffect.done.watch(fn)
  reeffect.fail.watch(fn)
  reeffect.cancelled.watch(fn)
  reeffect.finally.watch(fn)

  const result = await reeffect({ strategy: TAKE_EVERY })
  expect(result).toBe('test')

  expect(fn).toHaveBeenCalledTimes(2)

  // finally event
  expect(fn.mock.calls[0][0]).toEqual({
    params: undefined,
    result: 'test',
    status: 'done',
  })

  // done event
  expect(fn.mock.calls[1][0]).toEqual({
    params: undefined,
    result: 'test',
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

  // finally event
  expect(fn.mock.calls[0][0]).toEqual({
    params: 42,
    error: 'error',
    status: 'fail',
  })

  // fail event
  expect(fn.mock.calls[1][0]).toEqual({
    params: 42,
    error: 'error',
  })
})

test('createReEffect single sync failed operation', async () => {
  expect.assertions(4)
  const fn = jest.fn()

  const createReEffect = createReEffectFactory()
  const reeffect = createReEffect<number, string>({
    handler() {
      // tslint:disable-next-line no-string-throw
      throw 'error'
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

  // finally event
  expect(fn.mock.calls[0][0]).toEqual({
    params: 42,
    error: 'error',
    status: 'fail',
  })

  // fail event
  expect(fn.mock.calls[1][0]).toEqual({
    params: 42,
    error: 'error',
  })
})

test('createReEffect with TAKE_EVERY strategy', async () => {
  expect.assertions(7)
  const fn = jest.fn()

  const createReEffect = createReEffectFactory()
  const reeffect = createReEffect<number, string>({
    async handler(params) {
      return new Promise<string>(resolve =>
        setTimeout(() => resolve(`test${params}`), params)
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

  // finally event
  expect(fn.mock.calls[2][0]).toEqual({
    params: 22,
    result: 'test22',
    status: 'done',
  })

  // done event
  expect(fn.mock.calls[3][0]).toEqual({
    params: 22,
    result: 'test22',
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

  // finally event
  expect(fn.mock.calls[2][0]).toEqual({
    params: 22,
    result: 'resolve22',
    status: 'done',
  })

  // done event
  expect(fn.mock.calls[3][0]).toEqual({
    params: 22,
    result: 'resolve22',
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
    error: expect.any(CancelledError),
  })

  // finally event
  expect(fn.mock.calls[3][0]).toEqual({
    params: 11,
    result: 'test11',
    status: 'done',
  })

  // done event
  expect(fn.mock.calls[4][0]).toEqual({
    params: 11,
    result: 'test11',
  })

  // pending
  expect(fn.mock.calls[5][0]).toEqual(false)
})

test('createReEffect with TAKE_LAST strategy', async () => {
  expect.assertions(8)
  const fn = jest.fn()

  const createReEffect = createReEffectFactory()
  const reeffect = createReEffect<number, string>('name', {
    strategy: TAKE_LAST,
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
    reeffect(22),
  ])
  expect(result).toEqual([expect.any(CancelledError), 'test22'])

  expect(fn).toHaveBeenCalledTimes(6)

  // pending
  expect(fn.mock.calls[0][0]).toEqual(false)
  expect(fn.mock.calls[1][0]).toEqual(true)

  // cancelled event
  expect(fn.mock.calls[2][0]).toEqual({
    params: 11,
    error: expect.any(CancelledError),
  })

  // finally event
  expect(fn.mock.calls[3][0]).toEqual({
    params: 22,
    result: 'test22',
    status: 'done',
  })

  // done event
  expect(fn.mock.calls[4][0]).toEqual({
    params: 22,
    result: 'test22',
  })

  // pending
  expect(fn.mock.calls[5][0]).toEqual(false)
})

test('createReEffect with QUEUE strategy', async () => {
  expect.assertions(7)
  const fn = jest.fn()

  const createReEffect = createReEffectFactory()
  const reeffect = createReEffect<number, string>('test_queue_strategy', {
    strategy: QUEUE,
    async handler(params) {
      return new Promise<string>(resolve =>
        setTimeout(() => resolve(`test${params}`), 100)
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

  // finally event
  expect(fn.mock.calls[2][0]).toEqual({
    params: 22,
    result: 'test22',
    status: 'done',
  })

  // done event
  expect(fn.mock.calls[3][0]).toEqual({
    params: 22,
    result: 'test22',
  })

  // pending
  expect(fn.mock.calls[4][0]).toEqual(false)
})

test('createReEffect with QUEUE strategy and cancel', async () => {
  expect.assertions(7)
  const fn = jest.fn()

  const createReEffect = createReEffectFactory()
  const reeffect = createReEffect<number, string>('test_queue_strategy', {
    strategy: QUEUE,
    async handler(params) {
      return new Promise<string>(resolve =>
        setTimeout(() => resolve(`test${params}`), 1000)
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
    error: expect.any(CancelledError),
  })

  // cancelled event
  expect(fn.mock.calls[3][0]).toEqual({
    params: 22,
    error: expect.any(CancelledError),
  })

  // pending
  expect(fn.mock.calls[4][0]).toEqual(false)
})

test('createReEffect with QUEUE strategy and change handler', async () => {
  expect.assertions(10)
  const fn = jest.fn()

  const createReEffect = createReEffectFactory()
  const reeffect = createReEffect<number, string>('test_queue_strategy', {
    strategy: QUEUE,
    async handler(params) {
      return new Promise<string>(resolve =>
        setTimeout(() => resolve(`first${params}`), 100)
      )
    },
  })

  reeffect.done.watch(fn)
  reeffect.fail.watch(fn)
  reeffect.cancelled.watch(fn)
  reeffect.finally.watch(fn)
  reeffect.pending.watch(fn)

  reeffect(1).catch(error => error)
  const fx = reeffect(2).catch(error => error)

  reeffect.use(
    params =>
      new Promise<string>(resolve =>
        setTimeout(() => resolve(`second${params}`), 100)
      )
  )

  await fx
  await reeffect(3).catch(error => error)

  expect(fn).toHaveBeenCalledTimes(9)

  // pending
  expect(fn.mock.calls[0][0]).toEqual(false)
  expect(fn.mock.calls[1][0]).toEqual(true)

  // finally event
  expect(fn.mock.calls[2][0]).toEqual({
    params: 2,
    result: 'first2',
    status: 'done',
  })

  // done event
  expect(fn.mock.calls[3][0]).toEqual({
    params: 2,
    result: 'first2',
  })

  // pending
  expect(fn.mock.calls[4][0]).toEqual(false)
  expect(fn.mock.calls[5][0]).toEqual(true)

  // finally event
  expect(fn.mock.calls[6][0]).toEqual({
    params: 3,
    result: 'second3',
    status: 'done',
  })

  // done event
  expect(fn.mock.calls[7][0]).toEqual({
    params: 3,
    result: 'second3',
  })

  // pending
  expect(fn.mock.calls[8][0]).toEqual(false)
})

test('createReEffect with RACE strategy', async () => {
  expect.assertions(8)
  const fn = jest.fn()

  const createReEffect = createReEffectFactory()
  const reeffect = createReEffect<number, string>({
    feedback: true,
    async handler(params) {
      return new Promise<string>(resolve =>
        setTimeout(() => resolve(`resolve${params}`), params)
      )
    },
  })

  reeffect.done.watch(fn)
  reeffect.fail.watch(fn)
  reeffect.cancelled.watch(fn)
  reeffect.finally.watch(fn)
  reeffect.pending.watch(fn)

  const result = await Promise.all([
    reeffect(1000).catch(error => error),
    reeffect(100, { strategy: RACE }),
  ])
  expect(result).toEqual([expect.any(CancelledError), 'resolve100'])

  expect(fn).toHaveBeenCalledTimes(6)

  // pending
  expect(fn.mock.calls[0][0]).toEqual(false)
  expect(fn.mock.calls[1][0]).toEqual(true)

  // finally event
  expect(fn.mock.calls[2][0]).toEqual({
    params: 100,
    strategy: RACE,
    result: 'resolve100',
    status: 'done',
  })

  // done event
  expect(fn.mock.calls[3][0]).toEqual({
    params: 100,
    strategy: RACE,
    result: 'resolve100',
  })

  // pending
  expect(fn.mock.calls[4][0]).toEqual(false)

  // cancelled event
  expect(fn.mock.calls[5][0]).toEqual({
    params: 1000,
    strategy: TAKE_EVERY,
    error: expect.any(CancelledError),
  })
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
    error: expect.any(CancelledError),
  })

  // cancelled event
  expect(fn.mock.calls[3][0]).toEqual({
    params: 22,
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
    reeffect(22, { strategy: TAKE_LAST }),
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

  // finally event
  expect(fn.mock.calls[0][0]).toEqual({
    params: undefined,
    result: 'test',
    status: 'done',
  })

  // done event
  expect(fn.mock.calls[1][0]).toEqual({
    params: undefined,
    result: 'test',
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

  // finally event
  expect(fn.mock.calls[0][0]).toEqual({
    params: undefined,
    error: 'test',
    status: 'fail',
  })

  // done event
  expect(fn.mock.calls[1][0]).toEqual({
    params: undefined,
    error: 'test',
  })
})

test('createReEffect with feedback', async () => {
  expect.assertions(4)
  const fn = jest.fn()

  const createReEffect = createReEffectFactory()
  const reeffect = createReEffect<void, string>({
    feedback: true,
    async handler() {
      return new Promise<string>(resolve =>
        setTimeout(() => resolve('test'), 10)
      )
    },
  })

  reeffect.done.watch(fn)
  reeffect.fail.watch(fn)
  reeffect.cancelled.watch(fn)
  reeffect.finally.watch(fn)

  const result = await reeffect({ strategy: TAKE_EVERY })
  expect(result).toBe('test')

  expect(fn).toHaveBeenCalledTimes(2)

  // finally event
  expect(fn.mock.calls[0][0]).toEqual({
    params: undefined,
    strategy: TAKE_EVERY,
    result: 'test',
    status: 'done',
  })

  // done event
  expect(fn.mock.calls[1][0]).toEqual({
    params: undefined,
    strategy: TAKE_EVERY,
    result: 'test',
  })
})
