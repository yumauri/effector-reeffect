import {
  createApi,
  createEvent as effectorCreateEvent,
  createStore as effectorCreateStore,
  forward,
  merge,
} from 'effector'
import { HandlerFn, ReEffect, ReEffectConfig } from './types'
import { STRATEGY, TAKE_FIRST, TAKE_LAST } from './strategy'
import { cancel, CancellablePromise, wrap } from './promise'
import { CancelledError, LimitExceededError } from './error'
import { normalizeConfig, normalizeParams } from './config'

/**
 * ReEffect creator factory
 */
export const createReEffectFactory = (
  createEvent: typeof effectorCreateEvent = effectorCreateEvent
) => <Payload, Done, Fail = Error>(
  name?: string | ReEffectConfig<Payload, Done>,
  config?: ReEffectConfig<Payload, Done>
): ReEffect<Payload, Done, Fail> => {
  config = normalizeConfig(name, config)

  ////////////////////////////
  // main events for effect //
  ////////////////////////////

  const instance = createEvent<{ params: Payload; strategy: STRATEGY }>(config)
  const done = createEvent<{
    params: Payload
    strategy: STRATEGY
    result: Done
  }>(instance.shortName + '/done')
  const fail = createEvent<{
    params: Payload
    strategy: STRATEGY
    error: Fail
  }>(instance.shortName + '/fail')
  const anyway = createEvent<
    | { params: Payload; strategy: STRATEGY; result: Done; status: 'done' }
    | { params: Payload; strategy: STRATEGY; error: Fail; status: 'fail' }
  >(instance.shortName + '/finally')
  const cancelled = createEvent<{
    params: Payload
    strategy: STRATEGY
    error: CancelledError
  }>(instance.shortName + '/cancelled')
  const stop = createEvent(instance.shortName + '/cancel')

  // make `finally` event work
  forward({
    from: merge([done, fail]),
    // tslint:disable-next-line: no-any
    to: anyway.prepend((payload: any) => ({
      ...payload,
      status: 'result' in payload ? 'done' : 'fail',
    })),
  })

  //////////////////////
  // effect's handler //
  //////////////////////

  let handler = config.handler!
  function use(fn: HandlerFn<Payload, Done>) {
    handler = fn
    return reeffect
  }
  use.getCurrent = (): HandlerFn<Payload, Done> => handler

  ///////////////////////////////
  // currently running effects //
  ///////////////////////////////

  const running = new Set<CancellablePromise<Done>>()
  const $count = effectorCreateStore<number>(0)
  const count = createApi($count, {
    increment: count => count + 1,
    decrement: count => (count > 0 ? count - 1 : count),
  })

  /////////////////////
  // reeffect runner //
  /////////////////////

  const defaultStrategy = config.strategy!
  const defaultLimit = config.limit || Infinity
  function reeffect(
    paramsOrStrategy?: Payload | STRATEGY,
    strategyOrNothing?: STRATEGY
  ) {
    const { params, strategy } = normalizeParams(
      defaultStrategy,
      paramsOrStrategy,
      strategyOrNothing
    )

    // trigger reeffect itself
    instance({ params, strategy })

    // if we exceed `limit` -> immediately reject
    if (running.size >= defaultLimit) {
      const error = new LimitExceededError(defaultLimit, running.size)
      cancelled({ params, strategy, error })
      return Promise.reject(error)
    }

    // if we have running effects and strategy is `TAKE_FIRST` -> immediately reject
    if (strategy === TAKE_FIRST && running.size > 0) {
      const error = new CancelledError(strategy)
      cancelled({ params, strategy, error })
      return Promise.reject(error)
    }

    // if strategy is `TAKE_LAST` -> we should cancel all running effects first
    if (strategy === TAKE_LAST && running.size > 0) {
      for (const promise of running) {
        promise[cancel](strategy) // tslint:disable-line tsr-detect-unsafe-properties-access
      }
    }

    // increment currently running effects right before we run effect
    count.increment()

    // wrap handler Promise in CancellablePromise
    let promise: CancellablePromise<Done>
    let cancelHandlerCallback: undefined | (() => void)
    const onCancel = (callback: () => void) => {
      cancelHandlerCallback = callback
    }

    try {
      const handlerPromise = Promise.resolve(handler(params, onCancel))
      if (cancelHandlerCallback !== undefined) {
        handlerPromise[cancel] = cancelHandlerCallback
      }
      promise = wrap(handlerPromise)
    } catch (error) {
      promise = wrap(Promise.reject(error))
    }

    // put promise to running set
    running.add(promise)

    // add promise callbacks and return regular Promise,
    // so ReEffect could be used as usual Promise, like Effector's Effect
    return promise
      .then(result => {
        // trigger `done` event only for latest finished promise
        if (running.size === 1 && running.has(promise)) {
          done({ params, strategy, result })
        }
        running.delete(promise) && count.decrement() // remove resolved promise from running set
        return result
      })
      .catch(error => {
        // if promise was cancelled - trigger `cancelled` event
        if (error instanceof CancelledError) {
          cancelled({ params, strategy, error })
        }
        // trigger `done` event only for latest finished promise
        else if (running.size === 1 && running.has(promise)) {
          fail({ params, strategy, error })
        }
        running.delete(promise) && count.decrement() // remove resolved promise from running set
        throw error
      })
  }

  // watch `cancel` event
  stop.watch(() => {
    for (const promise of running) {
      promise[cancel]()
    }
  })

  // prepare return object, mimic Effect
  Object.assign(reeffect, instance)
  reeffect.done = done
  reeffect.fail = fail
  reeffect.finally = anyway
  reeffect.cancelled = cancelled
  reeffect.cancel = stop
  reeffect.use = use
  reeffect.pending = $count.map(count => count > 0) // pending state while count of running effects grater than zero

  // mask as Effector's Effect
  reeffect.kind = 'effect'

  // return prepared ReEffect
  return (reeffect as any) as ReEffect<Payload, Done, Fail> // tslint:disable-line no-any
}
