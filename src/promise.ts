import { CancelledError } from './error'
import { STRATEGY } from './strategy'

// `cancel` symbol, to avoid any interferetion with other properties
export const cancel = Symbol('cancel')

// Cancellable Promise type
export type CancellablePromise<T> = Promise<T> & {
  [cancel]: (strategy?: STRATEGY) => void
}

/**
 * Wrap Promise with `cancel` method
 */
export function wrap<Done>(
  promise: CancellablePromise<Done> | PromiseLike<Done> | Promise<Done>
): CancellablePromise<Done> {
  // create Promise we can cancel later
  let _cancel: (strategy?: STRATEGY) => void = noop
  const cancelable = new Promise<never>((_, reject) => {
    _cancel = function(strategy) {
      // reject promise with ErrorCanceled error
      reject(new CancelledError(strategy))

      // if we can cancel given promise -> do it
      if (cancel in promise && typeof promise[cancel] === 'function') {
        promise[cancel]()
      }
    }
  })

  // return race of two Promises, with exposed `.cancel()` method
  // to cancel our `cancelable` promise, created above, to finish race
  return Object.assign(Promise.race([promise, cancelable]), {
    [cancel]: _cancel,
  })
}

/**
 * No-op function, does nothing
 */
function noop() {} // tslint:disable-line no-empty
