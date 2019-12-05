import { CancelledError } from './error'
import { STRATEGY } from './strategy'

export const cancel = Symbol('cancel')

type cancelHandler = (strategy?: STRATEGY) => void
export type CancellablePromise<T> = Promise<T> & {
  [cancel]: cancelHandler
}

/**
 * Wrap Promise to CancellablePromise, with `cancel` method
 */
export function wrap<Done>(
  promise: CancellablePromise<Done> | PromiseLike<Done> | Promise<Done>
): CancellablePromise<Done> {
  let cancelPromise: cancelHandler | undefined
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
    [cancel]: cancelPromise!,
  })
}
