import {
  createEffect as effectorCreateEffect,
  createEvent,
  createStore,
} from 'effector'
import { CreateReEffect, CreateReEffectConfig, ReEffect } from './types'
import { patchInstance } from './instance'
import { patchRunner } from './runner'
import { TAKE_EVERY } from './strategy'

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
  const inFlightInternal = createStore(0)
  const pendingInternal = inFlightInternal.map(count => count > 0)

  // prettier-ignore
  const config =
    maybeConfig
      ? maybeConfig
      : nameOrConfig && typeof nameOrConfig === 'object'
        ? nameOrConfig
        : {}

  const scope = {
    strategy: config.strategy || TAKE_EVERY,
    feedback: config.feedback || false,
    limit: config.limit || Infinity,
    timeout: config.timeout,
    cancelled,
    cancel,
    inFlight: inFlightInternal,
    anyway: instance.finally,
  }

  patchRunner<Payload, Done, Fail>(instance.graphite.scope.runner, scope as any)
  patchInstance<Payload, Done, Fail>(instance, scope)
  instance.inFlight = inFlightInternal
  instance.pending = pendingInternal

  return instance
}
