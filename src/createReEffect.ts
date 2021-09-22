import { createEffect as effectorCreateEffect, createEvent } from 'effector'
import { CreateReEffect, CreateReEffectConfig, ReEffect } from './types'
import { CancellablePromise } from './promise'
import { patchInstance } from './instance'
import { patchRunner } from './runner'
import { Strategy, TAKE_EVERY } from './strategy'

/**
 * High-order function over createEffect
 * Creates `createReEffect` function, based on given `createEffect`
 */
export const createReEffectFactory = (
  createEffect = effectorCreateEffect
): CreateReEffect => <Payload, Done, Fail = Error>(
  nameOrConfig?: string | CreateReEffectConfig<Payload, Done>,
  maybeConfig?: CreateReEffectConfig<Payload, Done>
): ReEffect<Payload, Done, Fail> => {
  const instance = (createEffect as any)(nameOrConfig, maybeConfig)
  const cancelled = (createEvent as any)({ named: 'cancelled' })
  const cancel = (createEvent as any)({ named: 'cancel' })

  // prettier-ignore
  const config =
    maybeConfig
      ? maybeConfig
      : nameOrConfig && typeof nameOrConfig === 'object'
        ? nameOrConfig
        : {}

  const running: CancellablePromise<Done>[] = []

  const scope = {
    strategy: config.strategy || TAKE_EVERY,
    feedback: config.feedback || false,
    limit: config.limit || Infinity,
    timeout: config.timeout,
    cancelled,
    cancel,
    running,
    inFlight: instance.inFlight,
    anyway: instance.finally,

    push: (promise: CancellablePromise<Done>) => running.push(promise),
    unpush: (promise?: CancellablePromise<Done>) => {
      if (promise) {
        // `running` array should always contain `promise`
        // no need to check for index === -1
        running.splice(running.indexOf(promise), 1)
      }
      return running.length
    },
    cancelAll: (strategy?: Strategy) =>
      running.map(promise => promise.cancel(strategy)),
  }

  patchRunner<Payload, Done, Fail>(instance.graphite.scope.runner, scope as any)
  patchInstance<Payload, Done, Fail>(instance, scope)

  return instance
}
