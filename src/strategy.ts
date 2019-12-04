export const TAKE_QUEUE = Symbol('TAKE_QUEUE') // TODO: implement
export const TAKE_EVERY = Symbol('TAKE_EVERY')
export const TAKE_FIRST = Symbol('TAKE_FIRST')
export const TAKE_LAST = Symbol('TAKE_LAST')

export type STRATEGY =
  | typeof TAKE_QUEUE
  | typeof TAKE_EVERY
  | typeof TAKE_FIRST
  | typeof TAKE_LAST

export const isStrategy = (smth: any): smth is STRATEGY =>
  smth === TAKE_QUEUE ||
  smth === TAKE_EVERY ||
  smth === TAKE_FIRST ||
  smth === TAKE_LAST

export const getStrategyName = (strategy: STRATEGY) =>
  String(strategy).replace(/Symbol\((.*)\)/, '$1')
