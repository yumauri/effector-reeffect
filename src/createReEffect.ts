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
  const inFlightInternal = (createStore as any)(0, {
    named: 'reeffectInFlight',
  }).on(instance, s => s + 1)
  const pendingInternal = inFlightInternal.map({
    fn: amount => amount > 0,
    named: 'reeffectPending',
  })

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
    pending: pendingInternal,
    anyway: instance.finally,
  }

  patchRunner<Payload, Done, Fail>(instance.graphite.scope.runner, scope as any)
  patchInstance<Payload, Done, Fail>(instance, scope)

  return instance
}
