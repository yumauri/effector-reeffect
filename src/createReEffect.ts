import {
  createApi,
  createEvent as effectorCreateEvent,
  createStore as effectorCreateStore,
  forward,
  merge,
} from 'effector'
import { CreateReEffectConfig, HandlerFn, ReEffect } from './types'
import { STRATEGY, TAKE_FIRST, TAKE_LAST } from './strategy'
import { cancel, CancellablePromise, wrap } from './promise'
import { CancelledError, LimitExceededError, ReEffectError } from './error'
import { normalizeConfig, normalizeParams } from './config'

/**
 * ReEffect creator factory.
 * In some cases this factory is useful if user wants to use different `createEvent`
 * function, for example, to have all ReEffect's public events created inside Domain —
 * it is possible to pass `domain.event` here.
 * By default it uses top-level Effector's `createEvent`.
 */
export const createReEffectFactory = (
  createEvent: typeof effectorCreateEvent = effectorCreateEvent
) => <Payload, Done, Fail = Error>(
  name?: string | CreateReEffectConfig<Payload, Done>,
  config?: CreateReEffectConfig<Payload, Done>
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
    error: ReEffectError
  }>(instance.shortName + '/cancelled')
  const stop = createEvent(instance.shortName + '/cancel')

  // make `finally` (internally called `anyway`, because `finally` is reserved word) event work
  forward({
    from: merge([done, fail]),
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

    instance({ params, strategy })

    if (running.size >= defaultLimit) {
      const error = new LimitExceededError(defaultLimit, running.size)
      cancelled({ params, strategy, error })
      return Promise.reject(error)
    }

    if (strategy === TAKE_FIRST && running.size > 0) {
      const error = new CancelledError(strategy)
      cancelled({ params, strategy, error })
      return Promise.reject(error)
    }

    if (strategy === TAKE_LAST && running.size > 0) {
      for (const promise of running) {
        // tslint:disable-next-line tsr-detect-unsafe-properties-access
        promise[cancel](strategy)
      }
    }

    count.increment()

    // In order to be able to cancel this async operation, we
    //  1. add `[cancel]` callback to handler Promise - to cancel logic
    //  2. wrap handler Promise in CancellablePromise - to cancel promise

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

    running.add(promise)

    // add promise callbacks and return regular Promise,
    // so ReEffect could be used as usual Promise, like Effector's Effect
    return promise
      .then(result => {
        if (running.size === 1 && running.has(promise)) {
          done({ params, strategy, result })
        }
        running.delete(promise) && count.decrement()
        return result
      })
      .catch(error => {
        if (error instanceof CancelledError) {
          cancelled({ params, strategy, error })
        } else if (running.size === 1 && running.has(promise)) {
          fail({ params, strategy, error })
        }
        running.delete(promise) && count.decrement()
        throw error
      })
  }

  // watch `cancel` (internally called `stop` to avoid clashes with [cancel] symbol) event
  stop.watch(() => {
    for (const promise of running) {
      promise[cancel]()
    }
  })

  // prepare return object, mimic Effector's Effect
  Object.assign(reeffect, instance)
  reeffect.done = done
  reeffect.fail = fail
  reeffect.finally = anyway
  reeffect.cancelled = cancelled
  reeffect.cancel = stop
  reeffect.use = use
  reeffect.pending = $count.map(count => count > 0)
  reeffect.kind = 'effect'

  return (reeffect as any) as ReEffect<Payload, Done, Fail>
}
