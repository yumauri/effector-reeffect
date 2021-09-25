import { createNode, Event, launch, Node, step, Store } from 'effector'
import { CancelledError, LimitExceededError, ReEffectError } from './error'
import { QUEUE, RACE, Strategy, TAKE_FIRST, TAKE_LAST } from './strategy'
import { cancellable, CancellablePromise, defer } from './promise'
import { assign } from './tools'
import { CancelledPayload, FinallyPayload, Handler } from './types'

interface RunnerParams<Payload> {
  readonly params: Payload
  readonly args?: {
    strategy?: Strategy
    timeout?: number
  }
  readonly req: ReturnType<typeof defer>
}

interface RunnerScope<Payload, Done, Fail> {
  readonly getHandler: () => Handler<Payload, Done>
  readonly finally: Event<FinallyPayload<Payload, Done, Fail>>
  readonly strategy: Strategy
  readonly feedback: boolean
  readonly limit: number
  readonly timeout?: number
  readonly cancelled: Event<CancelledPayload<Payload>>
  readonly cancel: Event<void>
  readonly running: CancellablePromise<any>[]
  readonly inFlight: Store<number>
  readonly push: (promise: CancellablePromise<any>) => number
  readonly unpush: (promise?: CancellablePromise<any>) => number
  readonly cancelAll: (strategy?: Strategy) => void
}

const enum Result {
  DONE,
  FAIL,
  CANCEL,
}

/**
 * Patch runner, add new events and replace step sequence
 */
export const patchRunner = <Payload, Done, Fail>(
  runner: Node,
  scope: RunnerScope<Payload, Done, Fail>
) => {
  assign(runner.scope, scope)
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
        finally: anyway,
        strategy,
        feedback,
        limit,
        timeout,
        cancelled,
        running,
        inFlight,
        push,
        unpush,
        cancelAll,
      }: RunnerScope<Payload, Done, Fail>,
      { page }: { page: { [id: string]: any } | null }
    ) {
      strategy = (args && args.strategy) || strategy
      timeout = (args && args.timeout) || timeout

      const scope = {
        params,
        strategy,
        timeout,
        feedback,
        push,
        unpush,
        cancelAll,
        inFlight,
        page,
      }
      const go = run(
        scope,
        getHandler(),
        fin(scope, anyway, Result.DONE, req.rs),
        fin(scope, anyway, Result.FAIL, req.rj),
        fin(scope, cancelled, Result.CANCEL, req.rj)
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
  readonly timeout?: number
  readonly feedback: boolean
  readonly push: (promise: CancellablePromise<any>) => number
  readonly unpush: (promise?: CancellablePromise<any>) => number
  readonly cancelAll: (strategy?: Strategy) => void
  readonly inFlight: Store<number>
  readonly page: { [id: string]: any } | null
}

/**
 * Run effect, synchronously or asynchronously
 * Or immediately cancel effect, if error is passed
 */
const run = <Payload, Done>(
  { params, push, timeout }: Scope<Payload>,
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
    const promise = cancellable(result as any, cancel, timeout)
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
  {
    params,
    unpush,
    strategy,
    feedback,
    cancelAll,
    inFlight,
    page,
  }: Scope<Payload>,
  target: Event<any>,
  type: Result,
  fn: (data: any) => void
) => (promise?: CancellablePromise<any>) => (data: any) => {
  const runningCount = unpush(promise)
  const targets: (Event<any> | Store<number> | Node)[] = [inFlight, sidechain]
  const payloads: any[] = [runningCount, [fn, data]]

  // - if this is `cancelled` event
  // - if this was last event in `running`
  // - or strategy is RACE
  if (type === Result.CANCEL || !runningCount || strategy === RACE) {
    const body: any =
      type === Result.DONE
        ? { params, result: data, status: 'done' }
        : type === Result.FAIL
        ? { params, error: data, status: 'fail' }
        : { params, error: data }
    if (feedback) body.strategy = strategy

    targets.unshift(target)
    payloads.unshift(body)

    // check OUT-> strategies

    // only when event is `done` or `fail` (with `anyway`)
    if (strategy === RACE && type !== Result.CANCEL) {
      cancelAll(strategy)
    }
  }

  launch({
    target: targets,
    params: payloads,
    defer: true,
    page,
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
