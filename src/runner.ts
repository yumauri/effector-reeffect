import { createNode, Event, launch, step, Step, Store } from 'effector'
import { CancelledError, LimitExceededError, ReEffectError } from './error'
import { QUEUE, RACE, Strategy, TAKE_FIRST, TAKE_LAST } from './strategy'
import { cancellable, CancellablePromise, defer } from './promise'
import { assign } from './tools'
import {
  CancelledPayload,
  DonePayload,
  FailPayload,
  FinallyPayload,
  Handler,
} from './types'

interface RunnerParams<Payload> {
  readonly params: Payload
  readonly args?: { strategy?: Strategy }
  readonly req: ReturnType<typeof defer>
}

interface RunnerScope<Payload, Done, Fail> {
  readonly getHandler: () => Handler<Payload, Done>
  readonly done: Event<DonePayload<Payload, Done>>
  readonly fail: Event<FailPayload<Payload, Fail>>
  readonly anyway: Event<FinallyPayload<Payload, Done, Fail>>
  readonly cancelled: Event<CancelledPayload<Payload>>
  readonly cancel: Event<void>
  readonly strategy: Strategy
  readonly feedback: boolean
  readonly limit: number
  readonly running: CancellablePromise<any>[]
  readonly inFlight: Store<number>
  readonly push: (promise: CancellablePromise<any>) => number
  readonly unpush: (promise?: CancellablePromise<any>) => number
  readonly cancelAll: (strategy?: Strategy) => void
}

/**
 * Patch runner, add new events and replace step sequence
 */
export const patchRunner = <Payload, Done, Fail>(
  runner: Step,
  scope: RunnerScope<Payload, Done, Fail>
) => {
  assign(runner.scope, scope, {
    // prepend `finally` event to add 'status' field automatically, and replace in scope
    anyway: runner.scope.anyway.prepend(payload =>
      assign({ status: payload.result ? 'done' : 'fail' }, payload)
    ),
  })
  runner.meta.onCopy.push('cancelled', 'cancel')
  runner.seq = seq<Payload, Done, Fail>()

  // make `cancel` event work
  scope.cancel.watch(() => scope.cancelAll())
}

/**
 * Create new sequence for runner
 */
const seq = <Payload, Done, Fail>() => [
  step.run({
    fn(
      { params, args, req }: RunnerParams<Payload>,
      {
        getHandler,
        done,
        fail,
        anyway,
        cancelled,
        strategy,
        feedback,
        limit,
        running,
        inFlight,
        push,
        unpush,
        cancelAll,
      }: RunnerScope<Payload, Done, Fail>
    ) {
      strategy = (args && args.strategy) || strategy

      const scope = {
        params,
        strategy,
        feedback,
        push,
        unpush,
        cancelAll,
        inFlight,
      }
      const go = run(
        scope,
        getHandler(),
        fin(scope, [anyway, done], 'result', req.rs),
        fin(scope, [anyway, fail], 'error', req.rj),
        fin(scope, [cancelled], 'error', req.rj)
      )

      if (running.length >= limit) {
        return go(new LimitExceededError(limit, running.length))
      }

      // check ->IN strategies

      if (strategy === TAKE_FIRST && running.length > 0) {
        return go(new CancelledError(strategy))
      }

      if (strategy === TAKE_LAST && running.length > 0) {
        cancelAll(strategy)
      }

      if (strategy === QUEUE && running.length > 0) {
        const promise = cancellable(
          // this is analogue for Promise.allSettled()
          Promise.all(running.map(p => p.catch(() => {})))
        )
        push(promise)
        return promise.then(
          () => (unpush(promise), go()),
          error => (unpush(promise), go(error))
        )
      }

      go()
    },
  } as any),
]

interface Scope<Payload> {
  readonly params: Payload
  readonly strategy: Strategy
  readonly feedback: boolean
  readonly push: (promise: CancellablePromise<any>) => number
  readonly unpush: (promise?: CancellablePromise<any>) => number
  readonly cancelAll: (strategy?: Strategy) => void
  readonly inFlight: Store<number>
}

/**
 * Run effect, synchronously or asynchronously
 * Or immediately cancel effect, if error is passed
 */
const run = <Payload, Done>(
  { params, push }: Scope<Payload>,
  handler: Handler<Payload, Done>,
  onResolve: ReturnType<typeof fin>,
  onReject: ReturnType<typeof fin>,
  onCancel: ReturnType<typeof fin>
) => (immediatelyCancelError?: ReEffectError) => {
  if (immediatelyCancelError) {
    return onCancel()(immediatelyCancelError)
  }

  let cancel: (() => void) | undefined
  let result: Done | PromiseLike<Done>
  try {
    result = handler(params, abort => (cancel = abort))
  } catch (error) {
    return onReject()(error)
  }

  if (Object(result) === result && typeof (result as any).then === 'function') {
    const promise = cancellable(result as any, cancel)
    push(promise)
    return promise.then(onResolve(promise), error =>
      error instanceof CancelledError
        ? onCancel(promise)(error)
        : onReject(promise)(error)
    )
  }

  return onResolve()(result)
}

/**
 * onResolve / onReject / onCancel universal handler
 */
const fin = <Payload>(
  { params, unpush, strategy, feedback, cancelAll, inFlight }: Scope<Payload>,
  target: Array<Event<any> | Store<any> | Step>,
  field: 'result' | 'error',
  fn: (data: any) => void
) => (promise?: CancellablePromise<any>) => (data: any) => {
  const payload: any[] = []
  const runningCount = unpush(promise)

  // - if this was last event in `running`
  // - or strategy is RACE
  // - or this is single `cancelled` event
  if (!runningCount || strategy === RACE || target.length === 1) {
    const body = { params, [field]: data }
    if (feedback) {
      body.strategy = strategy
    }
    let i = target.length
    while (i--) {
      payload.push(body)
    }

    // check OUT-> strategies

    // only when event is `done` or `fail` (with `anyway`)
    if (strategy === RACE && target.length > 1) {
      cancelAll(strategy)
    }
  } else {
    // we are in the middle of running effects -> do not launch `done/fail`
    target = []
  }

  // add sidechain to always resolve/reject promise
  target.push(inFlight, sidechain)
  payload.push(runningCount, [fn, data])

  launch({
    target,
    params: payload,
    defer: true,
  } as any)
}

/**
 * Helper node to resolve or reject deferred promise
 */
const sidechain = createNode({
  node: [
    step.run({
      fn([fn, value]) {
        fn(value)
      },
    }),
  ],
  meta: { op: 'fx', fx: 'sidechain' },
} as any)
