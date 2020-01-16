import { Event, launch, Step } from 'effector'
import { CancelledPayload, MutableReEffect, ReEffectConfig } from './types'
import { CancellablePromise, defer } from './promise'
import { assign, own } from './tools'

interface InstanceNewEvents<Payload, Done> {
  readonly cancelled: Event<CancelledPayload<Payload>> & { graphite: Step }
  readonly cancel: Event<void> & { graphite: Step }
  readonly running: CancellablePromise<Done>[]
}

/**
 * Patch effect, add new events and change direct call
 */
export const patchInstance = <Payload, Done, Fail>(
  instance: MutableReEffect<Payload, Done, Fail>,
  { cancelled, cancel, running }: InstanceNewEvents<Payload, Done>
) => {
  assign(instance, { cancelled, cancel })
  own(instance, [cancelled, cancel])

  // reset `pending` when all handlers were cancelled
  instance.pending.reset(cancelled.filter({ fn: () => !running.length }))

  // adjust create function, to be able to set strategy, alongside with params
  instance.create = (paramsOrConfig, _, [strategyOrConfig]) => {
    // prettier-ignore
    const config = (
      paramsOrConfig && (paramsOrConfig as any).strategy
        ? paramsOrConfig
        : strategyOrConfig && (strategyOrConfig as any).strategy
          ? strategyOrConfig
          : { strategy: strategyOrConfig }
    ) as ReEffectConfig<Payload>

    const req = defer<Done>()
    launch<any>(instance, {
      params: config === paramsOrConfig ? config.params : paramsOrConfig,
      args: { strategy: config.strategy },
      req,
    })
    return req.req
  }
}
