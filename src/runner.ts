import {
  createEvent,
  createNode,
  Event,
  launch,
  Node as Step,
  Scope,
  step,
  Store,
} from 'effector'
import { CancelledError, LimitExceededError, ReEffectError } from './error'
import {
  QUEUE,
  RACE,
  Strategy,
  TAKE_EVERY,
  TAKE_FIRST,
  TAKE_LAST,
} from './strategy'
import {
  cancellable,
  CancellablePromise,
  createRunning,
  defer,
} from './promise'
import { assign, getForkPage, read, setMeta } from './tools'
import { CancelledPayload, FinallyPayload, Handler } from './types'

interface RunnerParams<Payload, Done> {
  readonly params: Payload
  readonly args?: {
    strategy?: Strategy
    timeout?: number
  }
  readonly req: ReturnType<typeof defer>
  readonly handler: Handler<Payload, Done>
}

interface RunnerScope<Payload, Done, Fail> {
  readonly finally: Event<FinallyPayload<Payload, Done, Fail>>
  readonly strategy: Strategy
  readonly feedback: boolean
  readonly limit: number
  readonly timeout?: number
  readonly cancelled: Event<CancelledPayload<Payload>>
  readonly cancel: Event<void>
  readonly running: CancellablePromise<any>[]
  readonly inFlight: Store<number>
  readonly anyway: Event<any>
  readonly push: ReturnType<typeof createRunning>['push']
  readonly unpush: ReturnType<typeof createRunning>['unpush']
  readonly cancelAll: ReturnType<typeof createRunning>['cancelAll']
  readonly $running: ReturnType<typeof createRunning>['$running']
  readonly scope: Scope
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
  runner: Step,
  runnerScope: RunnerScope<Payload, Done, Fail>
) => {
  const runs = createRunning<Done>()
  assign(runner.scope, runnerScope)
  runner.seq = seq<Payload, Done, Fail>(runnerScope.anyway, runs as any)

  // make `cancel` event work
  runnerScope.cancel.watch(() => runs.cancelAllEv())
}

/**
 * Create new sequence for runner
 */
const seq = <Payload, Done, Fail>(
  anyway: Event<any>,
  runs: ReturnType<typeof createRunning>
) => [
  // extract current handler of this reeffect
  step.compute({
    safe: true,
    filter: false,
    priority: 'effect',
    fn(upd, scopeArg, stack) {
      const scope: { handlerId: string; handler: Function } = scopeArg as any
      let handler = scope.handler
      if (getForkPage(stack)) {
        // FIXME
        // @ts-expect-error
        const handlerArg = getForkPage(stack).handlers[scope.handlerId]
        if (handlerArg) handler = handlerArg
      }
      upd.handler = handler
      return upd
    },
  }),
  step.run({
    fn(
      { params, args, req, handler }: RunnerParams<Payload, Done>,
      runScope: RunnerScope<Payload, Done, Fail>,
      { scope }: { scope: { [id: string]: any } | null }
    ) {
      const { feedback, limit, cancelled, inFlight } = runScope
      let { strategy, timeout } = runScope

      strategy = (args && args.strategy) || strategy
      timeout = (args && args.timeout) || timeout

      const runnerScope = {
        params,
        strategy,
        timeout,
        feedback,
        push: runs.push,
        unpush: runs.unpush,
        cancelAll: runs.cancelAll,
        inFlight,
        scope,
        $running: runs.$running,
      }
      const go = run(
        runnerScope,
        handler,
        fin(runnerScope, anyway, Result.DONE, req.rs),
        fin(runnerScope, anyway, Result.FAIL, req.rj),
        fin(runnerScope, cancelled, Result.CANCEL, req.rj)
      )

      const running = read(scope as Scope)(runs.$running)

      if (running.length >= limit) {
        return go(new LimitExceededError(limit, running.length))
      }

      // check ->IN strategies

      if (strategy === TAKE_FIRST && running.length > 0) {
        return go(new CancelledError(strategy))
      }

      if (strategy === TAKE_LAST && running.length > 0) {
        runs.cancelAll(strategy, scope as Scope)
      }

      if (strategy === QUEUE && running.length > 0) {
        const promise = cancellable(
          // this is analogue for Promise.allSettled()
          Promise.all(running.map(p => p.catch(() => {})))
        )
        runs.push(promise, scope as Scope)
        return promise.then(
          () => (runs.unpush(promise, scope as Scope), go()),
          error => (runs.unpush(promise, scope as Scope), go(error))
        )
      }

      go()
    },
  } as any),
]

interface ReEffectScope<Payload> {
  readonly params: Payload
  readonly strategy: Strategy
  readonly timeout?: number
  readonly feedback: boolean
  readonly push: ReturnType<typeof createRunning>['push']
  readonly unpush: ReturnType<typeof createRunning>['unpush']
  readonly cancelAll: ReturnType<typeof createRunning>['cancelAll']
  readonly inFlight: Store<number>
  readonly scope: { [id: string]: any } | null
  readonly $running: ReturnType<typeof createRunning>['$running']
}

/**
 * Run effect, synchronously or asynchronously
 * Or immediately cancel effect, if error is passed
 */
const run = <Payload, Done>(
  { params, push, timeout, scope }: ReEffectScope<Payload>,
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
    push(promise, scope as Scope)
    return promise.then(onResolve(promise), error =>
      error instanceof CancelledError
        ? onCancel(promise)(error)
        : onReject(promise)(error)
    )
  }

  return onResolve()(result)
}

/**
 * In current ReEffect implementation `finally` event fires only at the very end of the current strategy round
 * This means, that internal fxCounter in scope will not be decrementent properly (increments on each effect start)
 * and `allSettled` method will never settled - which breaks usage of ReEffect and Fork API
 *
 * To fix this, internalFinally event is created to manually decrement this counter after each reeffect is done
 */
const internalFinally = (createEvent as any)({ named: 'internalFinally' })
setMeta(internalFinally, 'needFxCounter', 'dec')

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
    scope,
    $running,
  }: ReEffectScope<Payload>,
  target: Event<any>,
  type: Result,
  fn: (data: any) => void
) => (promise?: CancellablePromise<any>) => (data: any) => {
  unpush(promise as any, scope as Scope)

  const runningCount = read(scope as Scope)($running).length
  const targets: (Event<any> | Store<number> | Step)[] = [sidechain]
  const payloads: any[] = [[fn, data]]

  // Run `finally` or `cancelled`
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
      cancelAll(strategy, scope as Scope)
    }
  } else if (runningCount && (strategy === TAKE_EVERY || strategy === QUEUE)) {
    // add internalFinally event to reconcile the internal fxCounter
    targets.push(internalFinally)
  }

  // internal inFlight also needs to be reconciled with actual running count
  // if running count is > 0 and this is not RACE winner or Cancellation
  // then inFlight must be synced in synchronous launch
  if (runningCount && (type !== Result.CANCEL || strategy !== RACE)) {
    launch({
      scope: scope as Scope,
      target: [inFlight],
      params: [runningCount],
    })
    // otherwise, deferred launch is preferred
    // this way observable behaviour of reeffect is not changed
  } else {
    targets.unshift(inFlight)
    payloads.unshift(runningCount)
  }

  launch({
    target: targets,
    params: payloads,
    defer: true,
    scope,
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
