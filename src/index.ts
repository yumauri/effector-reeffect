import { createReEffectFactory } from './createReEffect'

export { QUEUE, RACE, TAKE_EVERY, TAKE_FIRST, TAKE_LAST } from './strategy'
export {
  CancelledError,
  LimitExceededError,
  ReEffectError,
  TimeoutError,
} from './error'
export { ReEffect, CreateReEffectConfig, ReEffectConfig } from './types'

export { createReEffectFactory }
export const createReEffect = createReEffectFactory()
