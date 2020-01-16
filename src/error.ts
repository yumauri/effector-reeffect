import { RACE, Strategy, TAKE_FIRST, TAKE_LAST } from './strategy'

export class ReEffectError extends Error {
  constructor(message: string) {
    super(message)

    // stacktrace is useless here (because of async nature), so remove it
    delete this.stack
  }
}

export class CancelledError extends ReEffectError {
  constructor(strategy: Strategy | 'cancel' = 'cancel') {
    // prettier-ignore
    super(
      'Cancelled due to "' + strategy + '"' + ({
        [TAKE_FIRST]: `, there are already running effects`,
        [TAKE_LAST]: `, new effect was added`,
        [RACE]: `, other effect won race`,
        cancel: `, cancel all already running effects`,
      }[strategy] || `, but should not happen...`)
    )
  }
}

export class LimitExceededError extends ReEffectError {
  constructor(limit: number, running: number) {
    // prettier-ignore
    super(
      'Cancelled due to limit of "' + limit + '" exceeded,' +
      'there are already ' + running + ' running effects'
    )
  }
}
