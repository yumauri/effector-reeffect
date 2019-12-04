import { ReEffectConfig } from './types'
import { isStrategy, STRATEGY, TAKE_EVERY } from './strategy'

/**
 * Normalize config
 */
export function normalizeConfig<Payload, Done>(
  name?: string | ReEffectConfig<Payload, Done>,
  config?: ReEffectConfig<Payload, Done>
): ReEffectConfig<Payload, Done> {
  if (config === undefined) {
    config = typeof name === 'object' ? name : {}
  }
  if (typeof name === 'string') {
    config.name = name
  }

  // set noop handler
  if (config.handler === undefined) {
    config.handler = noop
  }

  // set default strategy
  if (config.strategy === undefined) {
    config.strategy = TAKE_EVERY
  }

  return config
}

/**
 * Normalize call parameters
 */
export function normalizeParams<Payload>(
  defaultStrategy: STRATEGY,
  paramsOrStrategy?: Payload | STRATEGY,
  strategyOrNothing?: STRATEGY
): { params: Payload; strategy: STRATEGY } {
  let params: Payload
  let strategy: STRATEGY
  if (isStrategy(paramsOrStrategy)) {
    strategy = paramsOrStrategy
    params = (undefined as unknown) as Payload
  } else {
    strategy = strategyOrNothing || defaultStrategy
    params = paramsOrStrategy as Payload
  }
  return { params, strategy }
}

/**
 * No-op handler, does nothing
 * And warns about forgotten handler
 */
function noop() {
  console.error('no handler used')
  return Promise.resolve() as Promise<any> // tslint:disable-line no-any
}
