import {
  getStrategyName,
  isStrategy,
  TAKE_EVERY,
  TAKE_FIRST,
  TAKE_LAST,
  TAKE_QUEUE,
} from './strategy'

test('isStrategy should check strategy', () => {
  expect(isStrategy(TAKE_EVERY)).toBe(true)
  expect(isStrategy(TAKE_FIRST)).toBe(true)
  expect(isStrategy(TAKE_LAST)).toBe(true)
  expect(isStrategy(TAKE_QUEUE)).toBe(true)
  expect(isStrategy('TAKE_EVERY')).toBe(false)
  expect(isStrategy('TAKE_FIRST')).toBe(false)
  expect(isStrategy('TAKE_LAST')).toBe(false)
  expect(isStrategy('TAKE_QUEUE')).toBe(false)
  expect(isStrategy(Symbol('TAKE_EVERY'))).toBe(false)
  expect(isStrategy(Symbol('TAKE_FIRST'))).toBe(false)
  expect(isStrategy(Symbol('TAKE_LAST'))).toBe(false)
  expect(isStrategy(Symbol('TAKE_QUEUE'))).toBe(false)
})

test('getStrategyName should return strategy name', () => {
  expect(getStrategyName(TAKE_EVERY)).toBe('TAKE_EVERY')
  expect(getStrategyName(TAKE_FIRST)).toBe('TAKE_FIRST')
  expect(getStrategyName(TAKE_LAST)).toBe('TAKE_LAST')
  expect(getStrategyName(TAKE_QUEUE)).toBe('TAKE_QUEUE')
})
