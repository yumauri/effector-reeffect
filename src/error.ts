import {
  getStrategyName,
  STRATEGY,
  TAKE_EVERY,
  TAKE_FIRST,
  TAKE_LAST,
  TAKE_QUEUE,
} from './strategy'

export class ReEffectError extends Error {
  constructor(message: string) {
    super(message)

    // stacktrace is useless here (because of async nature), so remove it
    delete this.stack
  }
}

export class CancelledError extends ReEffectError {
  constructor(strategy?: STRATEGY) {
    const name = strategy ? getStrategyName(strategy) : undefined
    let msg: string

    switch (strategy) {
      case TAKE_FIRST:
        msg = `Cancelled due to "${name}" strategy, there are already running effects`
        break

      case TAKE_LAST:
        msg = `Cancelled due to "${name}" strategy, new effect was added`
        break

      case TAKE_EVERY:
      case TAKE_QUEUE:
        msg = `Hm?.. Cancelled due to "${name}", but should not happen...`
        break

      default:
        msg = `Cancelled with "cancel" method, cancel all already running effects`
        break
    }

    super(msg)
  }
}

export class LimitExceededError extends ReEffectError {
  constructor(limit: number, running: number) {
    super(
      `Cancelled due to limit of "${limit}" exceeded, there are already ${running} running effects`
    )
  }
}
