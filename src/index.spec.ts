import { is } from 'effector'
import { createReEffect } from './index'

test('default createReEffect', () => {
  const reeffect = createReEffect()
  expect(is.effect(reeffect)).toBe(true)
})
