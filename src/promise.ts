import { CancelledError, TimeoutError } from './error'
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
  abort?: () => void,
  timeout?: number
): CancellablePromise<Done> => {
  let cancel: any
  const cancelable = new Promise<never>((_, reject) => {
    let timeoutId
    const rejectWith: {
      (Cls: typeof CancelledError): (strategy?: Strategy) => void
      (Cls: typeof TimeoutError): (timeout: number) => void
    } = Cls => arg => {
      clearTimeout(timeoutId)
      reject(new Cls(arg))
      abort && abort()
    }

    // set `.cancel()` callback
    cancel = rejectWith(CancelledError)

    // set timeout boundary
    if (typeof timeout === 'number') {
      timeoutId = setTimeout(rejectWith(TimeoutError), timeout, timeout)
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
