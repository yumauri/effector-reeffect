# effector-reeffect

[![Build Status](https://github.com/yumauri/effector-reeffect/workflows/build/badge.svg)](https://github.com/yumauri/effector-reeffect/actions?workflow=build)
[![License](https://img.shields.io/github/license/yumauri/effector-reeffect.svg?color=yellow)](./LICENSE)
[![NPM](https://img.shields.io/npm/v/effector-reeffect.svg)](https://www.npmjs.com/package/effector-reeffect)
![Made with Love](https://img.shields.io/badge/made%20with-❤-red.svg)

ReEffects for [Effector](https://github.com/zerobias/effector) ☄️<br>
Like regular Effects, but better :)

- Supports different launch strategies: TAKE_FIRST, TAKE_LAST, TAKE_EVERY
- Handles promises cancellation
- Can handle _logic_ cancellation

## Table of Contents

<!-- npx markdown-toc README.md -->

- [Install](#install)
- [Usage](#usage)
- [Strategies](#strategies)
  - [TAKE_EVERY](#take_every)
  - [TAKE_FIRST](#take_first)
  - [TAKE_LAST](#take_last)
- [Properties](#properties)
- [Options](#options)
- [Cancellation](#cancellation)
  - [axios](#axios)
  - [fetch](#fetch)
  - [ky](#ky)
  - [request](#request)
  - [XMLHttpRequest](#xmlhttprequest)
- [Sponsored](#sponsored)

## Install

```bash
$ yarn add effector-reeffect
```

Or using `npm`

```bash
$ npm install --save effector-reeffect
```

## Usage

In basic version you can use it like regular [Effect](https://effector.now.sh/en/api/effector/effect):

```javascript
import { createReEffect } from 'effector-reeffect'

// create ReEffect
const fetchUser = createReEffect({
  handler: ({ id }) =>
    fetch(`https://example.com/users/${id}`).then(res => res.json()),
})
```

Nothing special yet, created ReEffect has same properties, as usual Effect: Events `done`, `fail`, `finally`; Store `pending`; and methods `use(handler)`, `watch(watcher)`, `prepend(fn)`. Check out [documentation](https://effector.now.sh/en/api/effector/effect) to learn more.

Magic begins when you call ReEffect more that once, while previous asynchronous operation is not finished yet 🧙‍♂️

```javascript
import { createReEffect, TAKE_LAST } from 'effector-reeffect'

// create ReEffect
const fetchUser = createReEffect({
  handler: ({ id }) =>
    fetch(`https://example.com/users/${id}`).then(res => res.json()),
})

// call it once
fetchUser({ id: 1 }, TAKE_LAST)

// and somewhere in a galaxy far, far away
fetchUser({ id: 1 }, TAKE_LAST)
```

You see the new `TAKE_LAST` argument - this is called _strategy_, and _TAKE_LAST_ one ensures, that only latest call will trigger `done` (or `fail`) event. Each call still remain separate Promise, so you can _await_ it, but first one in the example above will be rejected with `CancelledError` instance (you can import this class from package and check `error instanceof CancelledError`).

## Strategies

### TAKE_EVERY

This is _default strategy_, if you will not specify any other.

<img width="475" alt="TAKE_EVERY" src="https://github.com/yumauri/effector-reeffect/blob/master/images/TAKE_EVERY.png?raw=true">

Second effect call will launch second asynchronous operation. In contrast with usual Effect, ReEffect will trigger `.done` (or `.fail`) event only for latest operation, and `.pending` store will contain `true` for a whole time of all operations (in other words, if there is at least single pending operation - `.pending` will hold `true`).

### TAKE_FIRST

<img width="355" alt="TAKE_FIRST" src="https://github.com/yumauri/effector-reeffect/blob/master/images/TAKE_FIRST.png?raw=true">

Second effect call will be immediately rejected with `CancelledError` (handler will not be executed at all).

### TAKE_LAST

<img width="475" alt="TAKE_LAST" src="https://github.com/yumauri/effector-reeffect/blob/master/images/TAKE_LAST.png?raw=true">

Second effect call will reject all currently pending operations (if any) with `CancelledError`.

## Properties

ReEffect has few new properties:

- `.cancelled`: Event triggered when any handler is rejected with `CancelledError` or `LimitExceededError` (this will be described later).
- `.cancel`: Event you can trigger to manually cancel all currently pending operations - each cancelled operation will trigger `.cancelled` event.

## Options

`createReEffect` function accepts same arguments as usual Effect, with few possible additions in config:

- `strategy`: this strategy will be considered as default, instead of `TAKE_EVERY`. Possible values: `TAKE_EVERY`, `TAKE_FIRST`, `TAKE_LAST`. **Note, that this values are _Symbols_, you _must_ import them from package!**
- `limit`: maximum count of simultaneously running operation, by default `Infinity`. If new effect call will exceed this value, call will be immediately rejected with `LimitExceededError` error.

```javascript
const fetchUser = createReEffect('fetchUser', {
  handler: ({ id }) =>
    fetch(`https://example.com/users/${id}`).then(res => res.json()),
  strategy: TAKE_LAST,
  limit: 3,
})
```

ReEffect, created with `createReEffect` function, behave like usual Effect, with one difference: in addition to effect's `payload` you can specify _strategy_ as a second argument (or first, if effect doesn't have payload). This strategy will override default strategy for this effect (but will not replace default strategy).

```javascript
fetchUser({ id: 2 }, TAKE_EVERY)
```

## Cancellation

ReEffect will handle Promises cancellation for you (so handler promise result will be ignored), _but it cannot cancel logic_ by itself! There are quite an amount of possible asynchronous operations, and each one could be cancelled differently (and some could not be cancelled at all).

But bright side of it is that you can tell ReEffect, _how to cancel your logic_ ☀️

To do this, `handler` accepts `onCancel` callback as a second argument, and you can specify, what actually to do on cancel.

Let me show an example:

```javascript
import { createReEffect, TAKE_LAST } from 'effector-reeffect'

const reeffect = createReEffect({ strategy: TAKE_LAST })

reeffect.watch(_ => console.log('reeffect called', _))
reeffect.done.watch(_ => console.log('reeffect done', _))
reeffect.fail.watch(_ => console.log('reeffect fail', _))
reeffect.cancelled.watch(_ => console.log('reeffect cancelled', _))

reeffect.use(
  params =>
    new Promise(resolve => {
      setTimeout(() => {
        console.log(`-> AHA! TIMEOUT FROM EFFECT WITH PARAMS: ${params}`)
        resolve('done')
      }, 1000)
    })
)

reeffect(1)
reeffect(2)
```

If you will run code above, you will get

```
reeffect called { params: 1, strategy: Symbol(TAKE_LAST) }
reeffect called { params: 2, strategy: Symbol(TAKE_LAST) }
reeffect cancelled { params: 1,
  strategy: Symbol(TAKE_LAST),
  error:
   Error: Cancelled due to "TAKE_LAST" strategy, new effect was added }
-> AHA! TIMEOUT FROM EFFECT WITH PARAMS: 1
-> AHA! TIMEOUT FROM EFFECT WITH PARAMS: 2
reeffect done { params: 2, strategy: Symbol(TAKE_LAST), result: 'done' }
```

As you can see, first effect call was rejected and cancelled, but timeout itself was not cancelled, and printed message.

Let's change code above:

```javascript
import { createReEffect, TAKE_LAST } from 'effector-reeffect'

const reeffect = createReEffect({ strategy: TAKE_LAST })

reeffect.watch(_ => console.log('reeffect called', _))
reeffect.done.watch(_ => console.log('reeffect done', _))
reeffect.fail.watch(_ => console.log('reeffect fail', _))
reeffect.cancelled.watch(_ => console.log('reeffect cancelled', _))

reeffect.use((params, onCancel) => {
  let timeout
  onCancel(() => clearTimeout(timeout))
  return new Promise(resolve => {
    timeout = setTimeout(() => {
      console.log(`-> AHA! TIMEOUT FROM EFFECT WITH PARAMS: ${params}`)
      resolve('done')
    }, 1000)
  })
})

reeffect(1)
reeffect(2)
```

Now ReEffect know, how to cancel your Promise's logic, and will do it while cancelling operation:

```
reeffect called { params: 1, strategy: Symbol(TAKE_LAST) }
reeffect called { params: 2, strategy: Symbol(TAKE_LAST) }
reeffect cancelled { params: 1,
  strategy: Symbol(TAKE_LAST),
  error:
   Error: Cancelled due to "TAKE_LAST" strategy, new effect was added }
-> AHA! TIMEOUT FROM EFFECT WITH PARAMS: 2
reeffect done { params: 2, strategy: Symbol(TAKE_LAST), result: 'done' }
```

This could be done with any asynchronous operation, which supports cancellation or abortion.

### [axios](https://github.com/axios/axios)

Axios supports cancellation via [_cancel token_](https://github.com/axios/axios#cancellation):

```javascript
reeffect.use(({ id }, onCancel) => {
  const source = CancelToken.source()
  onCancel(() => source.cancel())
  return axios.get(`https://example.com/users/${id}`, {
    cancelToken: source.token,
  })
})
```

### [fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)

Fetch API supports cancellation via [_AbortController_](https://developer.mozilla.org/en-US/docs/Web/API/AbortController) ([read more](https://developers.google.com/web/updates/2017/09/abortable-fetch)):

```javascript
reeffect.use(({ id }, onCancel) => {
  const controller = new AbortController()
  onCancel(() => controller.abort())
  return fetch(`https://example.com/users/${id}`, {
    signal: controller.signal,
  })
})
```

### [ky](https://github.com/sindresorhus/ky)

Ky is built on top of Fetch API, and supports cancellation via [_AbortController_](https://developer.mozilla.org/en-US/docs/Web/API/AbortController) as well:

```javascript
reeffect.use(({ id }, onCancel) => {
  const controller = new AbortController()
  onCancel(() => controller.abort())
  return ky(`https://example.com/users/${id}`, {
    signal: controller.signal,
  }).json()
})
```

### [request](https://github.com/request/request)

Request HTTP client supports [`.abort()` method](https://github.com/request/request/issues/772):

```javascript
reeffect.use(({ id }, onCancel) => {
  let r
  onCancel(() => r.abort())
  return new Promise((resolve, reject) => {
    r = request(`https://example.com/users/${id}`, (err, resp, body) =>
      err ? reject(err) : resolve(body)
    )
  })
})
```

### [XMLHttpRequest](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest)

If you happen to use good old `XMLHttpRequest`, I will not blame you (but others definitely will). Good to know it supports cancellation too, via [`.abort()` method](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/abort):

```javascript
reeffect.use(({ id }, onCancel) => {
  let xhr
  onCancel(() => xhr.abort())
  return new Promise(function(resolve, reject) {
    xhr = new XMLHttpRequest()
    xhr.open('GET', `https://example.com/users/${id}`)
    xhr.onload = function() {
      if (this.status >= 200 && this.status < 300) {
        resolve(xhr.response)
      } else {
        reject({
          status: this.status,
          statusText: xhr.statusText,
        })
      }
    }
    xhr.onerror = function() {
      reject({
        status: this.status,
        statusText: xhr.statusText,
      })
    }
    xhr.send()
  })
})
```

## Sponsored

[<img src="https://setplex.com/img/logo.png" alt="Setplex" width="236">](https://setplex.com)
