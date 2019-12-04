import { createReEffectFactory } from './createReEffect'
export { TAKE_EVERY, TAKE_FIRST, TAKE_LAST } from './strategy'
export { CancelledError, LimitExceededError } from './error'

// reexport `createReEffectFactory` factory
export { createReEffectFactory }

// export default `createReEffect` (using Effector's top-level `createEvent`)
export const createReEffect = createReEffectFactory()
