import { CreateReEffectConfig } from './types'
import { isStrategy, STRATEGY, TAKE_EVERY } from './strategy'

/**
 * Normalize `createReExport` config
 */
export function normalizeConfig<Payload, Done>(
  name?: string | CreateReEffectConfig<Payload, Done>,
  config?: CreateReEffectConfig<Payload, Done>
): CreateReEffectConfig<Payload, Done> {
  if (config === undefined) {
    config = typeof name === 'object' ? name : {}
  }
  if (typeof name === 'string') {
    config.name = name
  }

  if (config.handler === undefined) {
    config.handler = noop
  }

  if (config.strategy === undefined) {
    config.strategy = TAKE_EVERY
  }

  return config
}

/**
 * Normalize ReEffect call parameters
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
 * No-op default handler
 */
function noop() {
  console.error('no handler used')
  return Promise.resolve() as Promise<any>
}
