import { Effect, Event, Node as Step } from 'effector'
import { ReEffectError } from './error'
import { Strategy } from './strategy'

export interface CreateReEffectConfig<Payload, Done> {
  handler?: Handler<Payload, Done>
  name?: string
  sid?: string
  strategy?: Strategy
  feedback?: boolean
  limit?: number
  timeout?: number
}

export interface ReEffectConfig<Payload> {
  params?: Payload
  strategy?: Strategy
  timeout?: number
}

interface CallableReEffect<Payload, Done> {
  (params: Payload, strategy?: Strategy): Promise<Done>
  (params: Payload, config?: ReEffectConfig<Payload>): Promise<Done>
  (config?: ReEffectConfig<Payload>): Promise<Done>
}

// prettier-ignore
export interface ReEffect<Payload, Done, Fail = Error>
  extends
    CallableReEffect<Payload, Done>,
    Omit<Effect<Payload, Done, Fail>, 'done' | 'fail' | 'finally' | 'use'>
{
  readonly done: Event<DonePayload<Payload, Done>>
  readonly fail: Event<FailPayload<Payload, Fail>>
  readonly finally: Event<FinallyPayload<Payload, Done, Fail>>
  readonly cancelled: Event<CancelledPayload<Payload>>
  readonly cancel: Event<void>
  readonly use: {
    (handler: Handler<Payload, Done>): ReEffect<Payload, Done, Fail>
    // FIXME: original effect does not have onCancel in handler, types are incompatible again :(
    getCurrent(): (params: Payload) => Promise<Done>
  }
  // FIXME: effects do not have thru field, while events do - ReEffect type now fails in scopeBind because of that
  readonly thru: any
}

// prettier-ignore
export interface MutableReEffect<Payload, Done, Fail = Error>
  extends
    CallableReEffect<Payload, Done>,
    Mutable<ReEffect<Payload, Done, Fail>>
{
  graphite: Step,
  create: (
    paramsOrConfig: Payload | ReEffectConfig<Payload> | undefined,
    [maybeStrategyOrConfig]: [ReEffectConfig<Payload> | Strategy | undefined]
  ) => Promise<Done>
}

export type Handler<Payload, Done> = (
  payload: Payload,
  onCancel: (callback: () => any) => void
) => Promise<Done> | Done

export interface CreateReEffect {
  <Payload, Done, Fail = Error>(): ReEffect<Payload, Done, Fail>
  <Payload, Done, Fail = Error>(name: string): ReEffect<Payload, Done, Fail>
  <Payload, Done, Fail = Error>(
    config: CreateReEffectConfig<Payload, Done>
  ): ReEffect<Payload, Done, Fail>
  <Payload, Done, Fail = Error>(
    name: string,
    config: CreateReEffectConfig<Payload, Done>
  ): ReEffect<Payload, Done, Fail>
}

export type DonePayload<Payload, Done> = {
  params: Payload
  strategy?: Strategy
  result: Done
}

export type FailPayload<Payload, Fail> = {
  params: Payload
  strategy?: Strategy
  error: Fail
}

export type FinallyPayload<Payload, Done, Fail> =
  | (DonePayload<Payload, Done> & { status: 'done' })
  | (FailPayload<Payload, Fail> & { status: 'fail' })

export type CancelledPayload<Payload> = {
  params: Payload
  strategy?: Strategy
  error: ReEffectError
}

type Mutable<T> = {
  -readonly [P in keyof T]: T[P]
}
