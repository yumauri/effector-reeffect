import { createDomain, forward, scopeBind } from 'effector'
import { fork, serialize, allSettled } from 'effector/fork'
import { createReEffectFactory } from './createReEffect'
import { TAKE_FIRST, TAKE_LAST, QUEUE, RACE } from './strategy'

test('createReEffect resolves in fork by default', async () => {
  const createReEffect = createReEffectFactory()

  const app = createDomain()
  const start = app.createEvent()
  const $store = app.createStore(0, { name: '$store', sid: '$store' })
  const reeffect = createReEffect({
    async handler() {
      return 5
    },
  })

  $store.on(reeffect.done, (state, { result }) => state + result)

  forward({
    from: start,
    to: reeffect,
  })

  const scope = fork(app)

  await allSettled(start, {
    scope,
    params: undefined,
  })

  expect(serialize(scope)).toMatchInlineSnapshot(`
    Object {
      "$store": 5,
    }
  `)
})

test('createReEffect do not affect other forks', async () => {
  const createReEffect = createReEffectFactory()

  const app = createDomain()
  const start = app.createEvent<number>()
  const $store = app.createStore(0, { sid: '$store' })
  const reeffect = createReEffect({
    async handler(param: number) {
      return 5 * param
    },
  })

  $store.on(reeffect.done, (state, { result }) => state + result)

  forward({
    from: start,
    to: reeffect,
  })

  const scopeAlice = fork(app)
  const scopeBob = fork(app)

  await allSettled(start, {
    scope: scopeAlice,
    params: 10,
  })

  await allSettled(start, {
    scope: scopeBob,
    params: 1000,
  })

  expect(serialize(scopeAlice)).toMatchInlineSnapshot(`
    Object {
      "$store": 50,
    }
  `)

  expect(serialize(scopeBob)).toMatchInlineSnapshot(`
    Object {
      "$store": 5000,
    }
  `)
})

test('createReEffect in fork do not affect domain', async () => {
  const createReEffect = createReEffectFactory()

  const app = createDomain()
  const start = app.createEvent()
  const $store = app.createStore(0, { name: '$store', sid: '$store' })
  const reeffect = createReEffect({
    async handler() {
      return 5
    },
  })

  $store.on(reeffect.done, (state, { result }) => state + result)

  forward({
    from: start,
    to: reeffect,
  })

  const scope = fork(app)

  await allSettled(start, {
    scope,
    params: undefined,
  })

  expect($store.getState()).toMatchInlineSnapshot(`0`)
})

test('createReEffect resolves in scope with scopeBind', async () => {
  const app = createDomain()
  const createReEffect = createReEffectFactory(app.createEffect)
  const start = app.createEvent()
  const $store = app.createStore(0, { name: '$store', sid: '$store' })
  const reeffect = createReEffect<number, number>({
    async handler(p) {
      return p
    },
  })

  start.watch(() => {
    const bindReeffect = scopeBind(reeffect)

    bindReeffect(5)
  })

  $store.on(reeffect.done, (state, { result }) => state + result)

  const scope = fork(app)

  await allSettled(start, {
    scope,
    params: undefined,
  })

  expect(serialize(scope)).toMatchInlineSnapshot(`
    Object {
      "$store": 5,
    }
  `)
})

test('async createReEffect resolves in scope with scopeBind', async () => {
  const app = createDomain()
  const createReEffect = createReEffectFactory(app.createEffect)
  const start = app.createEvent()
  const $store = app.createStore(0, { name: '$store', sid: '$store' })
  const reeffect = createReEffect<number, number>({
    async handler(p) {
      await new Promise(r => setTimeout(r, 300))

      return Promise.resolve(p);
    },
  })

  start.watch(() => {
    const bindReeffect = scopeBind(reeffect)

    bindReeffect(5)
  })

  $store.on(reeffect.done, (state, { result }) => state + result)

  const scope = fork(app)

  await allSettled(start, {
    scope,
    params: undefined,
  })

  expect(serialize(scope)).toMatchInlineSnapshot(`
    Object {
      "$store": 5,
    }
  `)
})

test('createReEffect resolves in scope when called as `inner effect`', async () => {
  const app = createDomain()
  const createReEffect = createReEffectFactory(app.createEffect)
  const start = app.createEvent()
  const $store = app.createStore(0, { name: '$store', sid: '$store' })
  const reeffect = createReEffect<number, number>({
    async handler(p) {
      return p
    },
  })
  const effect = app.createEffect(async () => {
    await reeffect(5)
  })

  $store.on(reeffect.done, (state, { result }) => state + result)

  forward({
    from: start,
    to: effect,
  })

  const scope = fork(app)

  await allSettled(start, {
    scope,
    params: undefined,
  })

  expect(serialize(scope)).toMatchInlineSnapshot(`
    Object {
      "$store": 5,
    }
  `)
})

test('createReEffect in scope: cancelled reeffect does not hanging up `allSettled`', async () => {
  const app = createDomain()
  const createReEffect = createReEffectFactory(app.createEffect)
  const start = app.createEvent()
  const $store = app.createStore(0, { name: '$store', sid: '$store' })
  const reeffect = createReEffect<number, number>({
    async handler(p) {
      await new Promise(r => setTimeout(r, 900))

      return Promise.resolve(p);
    },
  })
  const delayFx = app.createEffect<number, number>(async (t) => new Promise(r => setTimeout(() => r(t), t)));

  forward({
    from: start,
    to: delayFx.prepend(() => 250)
  })

  forward({
    from: delayFx.done,
    to: reeffect.cancel
  })

  start.watch(() => {
    const bindReeffect = scopeBind(reeffect)

    bindReeffect(5)
  })

  $store.on(reeffect.done, (state, { result }) => state + result)

  const scope = fork(app)

  await allSettled(start, {
    scope,
    params: undefined,
  })

  expect(serialize(scope)).toMatchInlineSnapshot(`
    Object {
      "$store": 5,
    }
  `)
})

test('createReEffect in scope: multiple calls aren`t hanging up `allSettled`', async () => {
  const cancelled = jest.fn()

  const app = createDomain()
  const createReEffect = createReEffectFactory(app.createEffect)
  const start = app.createEvent()
  const secondTrigger = app.createEvent()
  const $store = app.createStore(0, { name: '$store', sid: '$store' })
  const reeffect = createReEffect({
    async handler() {
      return new Promise<number>(resolve =>
        setTimeout(() => resolve(5), 300)
      )
    },
  })

  reeffect.cancelled.watch(cancelled)

  forward({
    from: start,
    to: reeffect
  })

  forward({
    from: start,
    to: secondTrigger
  })

  forward({
    from: secondTrigger,
    to: reeffect
  })

  $store.on(reeffect.done, (state, { result }) => state + result)

  const scope = fork(app)

  await allSettled(start, {
    scope,
    params: undefined,
  })

  expect(cancelled).toBeCalledTimes(2)

  expect(serialize(scope)).toMatchInlineSnapshot(`
    Object {
      "$store": 5,
    }
  `)
})

test('createReEffect in scope: TAKE_EVERY', async () => {
  const cancelled = jest.fn()

  const app = createDomain()
  const createReEffect = createReEffectFactory(app.createEffect)
  const start = app.createEvent()
  const $store = app.createStore(0, { name: '$store', sid: '$store' })
  const reeffect = createReEffect<number, number>({
    async handler(p) {
      return new Promise<number>(resolve =>
        setTimeout(() => resolve(p), 300)
      )
    },
  })

  reeffect.cancelled.watch(cancelled)

  start.watch(() => {
    const bindReeffect = scopeBind(reeffect)

    bindReeffect(1)
    bindReeffect(2)
    bindReeffect(5)
  })

  $store.on(reeffect.done, (state, { result }) => state + result)

  const scope = fork(app)

  await allSettled(start, {
    scope,
    params: undefined,
  })

  expect(cancelled).toBeCalledTimes(2)

  expect(serialize(scope)).toMatchInlineSnapshot(`
    Object {
      "$store": 5,
    }
  `)
})

test('createReEffect in scope: TAKE_FIRST', async () => {
  const cancelled = jest.fn()

  const app = createDomain()
  const createReEffect = createReEffectFactory(app.createEffect)
  const start = app.createEvent()
  const $store = app.createStore(0, { name: '$store', sid: '$store' })
  const reeffect = createReEffect<number, number>({
    async handler(p) {
      return new Promise<number>(resolve =>
        setTimeout(() => resolve(p), 300)
      )
    },
    strategy: TAKE_FIRST,
  })

  reeffect.cancelled.watch(cancelled)

  start.watch(() => {
    const bindReeffect = scopeBind(reeffect)

    bindReeffect(5)
    bindReeffect(2)
    bindReeffect(3)
  })

  $store.on(reeffect.done, (state, { result }) => state + result)

  const scope = fork(app)

  await allSettled(start, {
    scope,
    params: undefined,
  })

  expect(cancelled).toBeCalledTimes(2)

  expect(serialize(scope)).toMatchInlineSnapshot(`
    Object {
      "$store": 5,
    }
  `)
})

test('createReEffect in scope: TAKE_LAST', async () => {
  const cancelled = jest.fn()

  const app = createDomain()
  const createReEffect = createReEffectFactory(app.createEffect)
  const start = app.createEvent()
  const $store = app.createStore(0, { name: '$store', sid: '$store' })
  const reeffect = createReEffect<number, number>({
    async handler(p) {
      return new Promise<number>(resolve =>
        setTimeout(() => resolve(p), 300)
      )
    },
    strategy: TAKE_LAST,
  })

  reeffect.cancelled.watch(cancelled)

  start.watch(() => {
    const bindReeffect = scopeBind(reeffect)

    bindReeffect(5)
    bindReeffect(2)
    bindReeffect(5)
  })

  $store.on(reeffect.done, (state, { result }) => state + result)

  const scope = fork(app)

  await allSettled(start, {
    scope,
    params: undefined,
  })

  expect(cancelled).toBeCalledTimes(2)

  expect(serialize(scope)).toMatchInlineSnapshot(`
    Object {
      "$store": 5,
    }
  `)
})

test('createReEffect in scope: QUEUE', async () => {
  const cancelled = jest.fn()

  const app = createDomain()
  const createReEffect = createReEffectFactory(app.createEffect)
  const start = app.createEvent()
  const $store = app.createStore(0, { name: '$store', sid: '$store' })
  const reeffect = createReEffect<number, number>({
    async handler(p) {
      return new Promise<number>(resolve =>
        setTimeout(() => resolve(p), 300)
      )
    },
    strategy: QUEUE,
  })

  reeffect.cancelled.watch(cancelled)

  start.watch(() => {
    const bindReeffect = scopeBind(reeffect)

    bindReeffect(1)
    bindReeffect(2)
    bindReeffect(3)
  })

  $store.on(reeffect.done, (state, { result }) => state + result)

  const scope = fork(app)

  await allSettled(start, {
    scope,
    params: undefined,
  })

  expect(cancelled).toBeCalledTimes(2)

  expect(serialize(scope)).toMatchInlineSnapshot(`
    Object {
      "$store": 5,
    }
  `)
})

test('createReEffect in scope: RACE', async () => {
  const cancelled = jest.fn()

  const app = createDomain()
  const createReEffect = createReEffectFactory(app.createEffect)
  const start = app.createEvent()
  const $store = app.createStore(0, { name: '$store', sid: '$store' })
  const reeffect = createReEffect<number, number>({
    async handler(p) {
      const timeout = p === 5 ? 100 : 600

      return new Promise<number>(resolve =>
        setTimeout(() => resolve(p), timeout)
      )
    },
    strategy: RACE,
  })

  reeffect.cancelled.watch(cancelled)

  start.watch(() => {
    const bindReeffect = scopeBind(reeffect)

    bindReeffect(2)
    bindReeffect(2)
    bindReeffect(5)
  })

  $store.on(reeffect.done, (state, { result }) => state + result)

  const scope = fork(app)

  await allSettled(start, {
    scope,
    params: undefined,
  })

  expect(cancelled).toBeCalledTimes(2)

  expect(serialize(scope)).toMatchInlineSnapshot(`
    Object {
      "$store": 5,
    }
  `)
})
