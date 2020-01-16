export const QUEUE = 'QUEUE'
export const RACE = 'RACE'
export const TAKE_EVERY = 'TAKE_EVERY'
export const TAKE_FIRST = 'TAKE_FIRST'
export const TAKE_LAST = 'TAKE_LAST'

export type Strategy =
  | typeof QUEUE
  | typeof RACE
  | typeof TAKE_EVERY
  | typeof TAKE_FIRST
  | typeof TAKE_LAST
