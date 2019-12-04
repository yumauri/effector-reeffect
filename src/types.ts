import { Effect, Event } from 'effector'
import { STRATEGY } from './strategy'
import { CancelledError } from './error'

// ReEffect interface
export interface ReEffect<Payload, Done, Fail = Error>
  extends Effect<Payload, Done, Fail> {
  (payload: Payload, strategy?: STRATEGY): Promise<Done>
  (strategy: STRATEGY): Promise<Done>

  // properies absent in Effector's Effect
  readonly cancelled: Event<{ params: Payload; error: CancelledError }>
  readonly cancel: Event<void>
}

// ReEffect config interface
export type HandlerFn<Payload, Done> = (
  payload: Payload
) => Promise<Done> | Done

// ReEffect config
export type ReEffectConfig<Payload, Done> = {
  handler?: HandlerFn<Payload, Done>
  name?: string
  sid?: string
  strategy?: STRATEGY
  limit?: number
}
