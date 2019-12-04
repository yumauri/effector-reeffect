import { Effect, Event } from 'effector'
import { STRATEGY } from './strategy'
import { CancelledError } from './error'

export interface ReEffect<Payload, Done, Fail = Error>
  extends Effect<Payload, Done, Fail> {
  (payload: Payload, strategy?: STRATEGY): Promise<Done>
  (strategy: STRATEGY): Promise<Done>

  // properies absent or different in Effector's Effect
  readonly cancelled: Event<{ params: Payload; error: CancelledError }>
  readonly cancel: Event<void>
  readonly use: {
    (handler: HandlerFn<Payload, Done>): ReEffect<Payload, Done, Fail>
    getCurrent(): (params: Payload) => Promise<Done> // FIXME: should be HandlerFn<Payload, Done>
  }
}

export type HandlerFn<Payload, Done> = (
  payload: Payload,
  onCancel: (callback: () => void) => void
) => Promise<Done> | Done

export type CreateReEffectConfig<Payload, Done> = {
  handler?: HandlerFn<Payload, Done>
  name?: string
  sid?: string
  strategy?: STRATEGY
  limit?: number
}
