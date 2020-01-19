import { CancelledError } from './error'
import { Strategy } from './strategy'
import { assign } from './tools'

export type CancellablePromise<T> = Promise<T> & {
  cancel: (strategy?: Strategy) => void
}

/**
 * Wrap promise to CancellablePromise, with `cancel` method
 */
export const cancellable = <Done>(
  promise: PromiseLike<Done>,
  abort?: () => void
): CancellablePromise<Done> => {
  let cancel: any
  const cancelable = new Promise<never>((_, reject) => {
    cancel = (strategy?: Strategy) => {
      reject(new CancelledError(strategy))
      abort && abort()
    }
  })

  // return race of two Promises, with exposed `.cancel()` method
  // to cancel our `cancelable` promise, created above, to finish race
  return assign(Promise.race([promise, cancelable]), { cancel })
}

/**
 * Creates deferred promise
 */
export const defer = <Done>(): {
  rs: (value?: Done | PromiseLike<Done> | undefined) => void
  rj: (reason?: any) => void
  req: Promise<Done>
} => {
  const deferred: any = {}
  deferred.req = new Promise((resolve, reject) => {
    deferred.rs = resolve
    deferred.rj = reject
  })
  deferred.req.catch(() => {})
  return deferred
}
