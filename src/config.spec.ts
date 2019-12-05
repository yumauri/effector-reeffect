import { normalizeConfig, normalizeParams } from './config'
import { TAKE_EVERY, TAKE_LAST } from './strategy'

console.error = jest.fn()

test('normalizeConfig should normalize config', () => {
  const defs = {
    handler: expect.any(Function),
    strategy: TAKE_EVERY,
  }

  expect(normalizeConfig()).toEqual({ ...defs })
  expect(normalizeConfig('test')).toEqual({ ...defs, name: 'test' })
  expect(normalizeConfig('test', {})).toEqual({ ...defs, name: 'test' })
  expect(normalizeConfig('test', { name: 'test1' })).toEqual({
    ...defs,
    name: 'test', // first argument has precedence
  })
  expect(normalizeConfig('test', { strategy: TAKE_LAST })).toEqual({
    ...defs,
    name: 'test',
    strategy: TAKE_LAST,
  })

  let handler

  handler = normalizeConfig().handler
  expect(typeof handler).toBe('function')
  expect(handler(1, () => {})).toEqual(expect.any(Promise))

  handler = normalizeConfig({ handler: () => 'test' }).handler
  expect(typeof handler).toBe('function')
  expect(handler(1, () => {})).toBe('test')
})

test('normalizeParams should normalize params', () => {
  expect(normalizeParams(TAKE_EVERY)).toEqual({
    params: undefined,
    strategy: TAKE_EVERY,
  })
  expect(normalizeParams(TAKE_EVERY, TAKE_LAST)).toEqual({
    params: undefined,
    strategy: TAKE_LAST,
  })
  expect(normalizeParams(TAKE_EVERY, 'test', TAKE_LAST)).toEqual({
    params: 'test',
    strategy: TAKE_LAST,
  })
  expect(normalizeParams(TAKE_EVERY, 'test')).toEqual({
    params: 'test',
    strategy: TAKE_EVERY,
  })
})
