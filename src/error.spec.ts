import { CancelledError, LimitExceededError, ReEffectError } from './error'
import { TAKE_EVERY, TAKE_FIRST, TAKE_LAST, TAKE_QUEUE } from './strategy'

test('ReEffectError class', () => {
  const err = new ReEffectError('test')
  expect(err instanceof Error).toBe(true)
  expect(err.stack).toBeUndefined()
  expect(err.message).toBe('test')
})

test('CancelledError class', () => {
  expect(new CancelledError() instanceof ReEffectError).toBe(true)
  expect(new CancelledError(TAKE_EVERY) instanceof ReEffectError).toBe(true)
  expect(new CancelledError(TAKE_FIRST) instanceof ReEffectError).toBe(true)
  expect(new CancelledError(TAKE_LAST) instanceof ReEffectError).toBe(true)
  expect(new CancelledError(TAKE_QUEUE) instanceof ReEffectError).toBe(true)
})

test('LimitExceededError class', () => {
  expect(new LimitExceededError(1, 1) instanceof ReEffectError).toBe(true)
})
