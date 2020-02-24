import { Event, launch, Step, step } from 'effector'
import { CancelledPayload, MutableReEffect, ReEffectConfig } from './types'
import { defer } from './promise'
import { assign, own } from './tools'

interface InstanceNewEvents<Payload> {
  readonly cancelled: Event<CancelledPayload<Payload>> & { graphite: Step }
  readonly cancel: Event<void> & { graphite: Step }
  readonly feedback: boolean
}

/**
 * Patch effect, add new events and change direct call
 */
export const patchInstance = <Payload, Done, Fail>(
  instance: MutableReEffect<Payload, Done, Fail>,
  { cancelled, cancel, feedback }: InstanceNewEvents<Payload>
) => {
  assign(instance, { cancelled, cancel })
  own(instance, [cancelled, cancel])

  // adjust create function, to be able to set strategy, alongside with params
  instance.create = (paramsOrConfig, _, [strategyOrConfig]) => {
    // prettier-ignore
    const config = (
      paramsOrConfig && ((paramsOrConfig as any).strategy || (paramsOrConfig as any).timeout)
        ? paramsOrConfig
        : strategyOrConfig && ((strategyOrConfig as any).strategy || (strategyOrConfig as any).timeout)
          ? strategyOrConfig
          : { strategy: strategyOrConfig }
    ) as ReEffectConfig<Payload>

    const req = defer<Done>()
    launch<any>(instance, {
      params: config === paramsOrConfig ? config.params : paramsOrConfig,
      args: {
        strategy: config.strategy,
        timeout: config.timeout,
      },
      req,
    })
    return req.req
  }

  // adjust `done`/`fail` events in case of feedback = true
  if (feedback) {
    const feedbackStep = step.compute({
      fn(data, _, stack) {
        // https://github.com/zerobias/effector/pull/312
        // https://share.effector.dev/wfu6mWpc
        data.strategy = stack.parent.parent.value.strategy
        return data
      },
    } as any)
    ;(instance.done as any).graphite.seq.push(feedbackStep)
    ;(instance.fail as any).graphite.seq.push(feedbackStep)
  }
}
