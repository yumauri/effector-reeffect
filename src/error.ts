import {
  STRATEGY,
  TAKE_EVERY,
  TAKE_FIRST,
  TAKE_LAST,
  TAKE_QUEUE,
} from './strategy'

/**
 * CanceledError error class
 */
export class CancelledError extends Error {
  constructor(strategy?: STRATEGY) {
    const name = strategy
      ? String(strategy).replace(/Symbol\((.*)\)/, '$1')
      : undefined
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

    // remove stacktrace
    // (show me the case when it is usable)
    delete this.stack
  }
}

/**
 * LimitExceededError class
 */
export class LimitExceededError extends Error {
  constructor(limit: number, running: number) {
    super(
      `Cancelled due to limit of "${limit}" exceeded, there are already ${running} running effects`
    )

    // remove stacktrace
    // (show me the case when it is usable)
    delete this.stack
  }
}
