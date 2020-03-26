import { createDomain, forward } from 'effector'
import { fork, serialize, allSettled } from 'effector/fork'
import { createReEffectFactory } from './createReEffect'

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
