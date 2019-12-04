import { CancelledError } from './error'
import { STRATEGY } from './strategy'

export const cancel = Symbol('cancel')

export type CancellablePromise<T> = Promise<T> & {
  [cancel]: (strategy?: STRATEGY) => void
}

/**
 * Wrap Promise to CancellablePromise, with `cancel` method
 */
export function wrap<Done>(
  promise: CancellablePromise<Done> | PromiseLike<Done> | Promise<Done>
): CancellablePromise<Done> {
  let cancelPromise: (strategy?: STRATEGY) => void = noop
  const cancelable = new Promise<never>((_, reject) => {
    cancelPromise = function(strategy) {
      reject(new CancelledError(strategy))
      if (cancel in promise && typeof promise[cancel] === 'function') {
        promise[cancel]()
      }
    }
  })

  // return race of two Promises, with exposed `[cancel]()` method
  // to cancel our `cancelable` promise, created above, to finish race
  return Object.assign(Promise.race([promise, cancelable]), {
    [cancel]: cancelPromise,
  })
}

/**
 * No-op default cancel promise callback, does nothing
 */
function noop() {}
