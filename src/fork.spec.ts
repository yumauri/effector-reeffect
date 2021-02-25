import { createDomain, forward } from 'effector'
import { fork, serialize, allSettled } from 'effector/fork'
import { createReEffectFactory } from './createReEffect'
import { TAKE_EVERY } from './strategy'

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

test('createReEffect in fork: TAKE_EVERY works', async () => {
  expect.assertions(1)
  const strategy = TAKE_EVERY

  const app = createDomain()
  const createReEffect = createReEffectFactory(app.createEffect)
  const start = app.createEvent()
  const triggerOne = app.createEvent()
  const triggerTwo = app.createEvent()
  const $store = app.createStore(0, { name: '$store', sid: '$store' })
  const reeffect = createReEffect({
    handler() {

      return Promise.resolve(2);
    },
    strategy
  })

  $store.on(reeffect.done, (state, { result }) => state + result)

  forward({
    from: triggerOne,
    to: reeffect
  })

  forward({
    from: triggerTwo,
    to: reeffect
  })

  forward({
    from: triggerOne,
    to: triggerTwo,
  })

  forward({
    from: start,
    to: triggerOne
  });

  const scope = fork(app)

  await allSettled(start, {
    scope,
    params: undefined,
  })

  expect(serialize(scope)).toMatchInlineSnapshot(`
    Object {
      "$store": 2,
    }
  `)
})
