// Run ReEffect strategies
export const TAKE_QUEUE = Symbol('TAKE_QUEUE') // TODO: implement
export const TAKE_EVERY = Symbol('TAKE_EVERY')
export const TAKE_FIRST = Symbol('TAKE_FIRST')
export const TAKE_LAST = Symbol('TAKE_LAST')

// Type for all consts
export type STRATEGY =
  | typeof TAKE_QUEUE
  | typeof TAKE_EVERY
  | typeof TAKE_FIRST
  | typeof TAKE_LAST

// is something is STRATEGY checker
// tslint:disable-next-line: no-any
export const isStrategy = (smth: any): smth is STRATEGY =>
  smth === TAKE_QUEUE ||
  smth === TAKE_EVERY ||
  smth === TAKE_FIRST ||
  smth === TAKE_LAST
