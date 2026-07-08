# idb-opfs

IndexedDB-backed implementation of the [origin private file system](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system).

Motivation for the creation of this monster is to get around the [unavailability of OPFS in Playwright's WebKit Build](https://github.com/microsoft/playwright/issues/18235).

Simply using a in-memory OPFS implementation does not suffice in that case, since OPFS is shared between the main thread and Web Workers.

The only built-in Web API that offers a read/write storage that's shared between web workers and the main thread is (afaik) IndexedDB.

At first I wanted to just contribute additional options for opfs-mock, allowing the caller to supply objects for the in-memory files & directories Map objects, but IndexedDB reads & writes are not synchronous, so I figured it was better to just fork the package, since the use case is very niche anyways.

## Installation

```shell
npm install --save-dev idb-opfs
```

## Limitations

- [Limitations from `mock-opfs` itself]() still applies
- The browser is assumed to have [`Uint8Array` to/from base64](), a Baseline 2025 feature.


## Usage

```ts
import "idb-opfs"
```

Since this is very specific to Playwright, here's usage instructions specifically for Playwright:

```ts
import { readFileSync } from 'node:fs'
import { test as base } from '@playwright/test'

const idbOpfsSource = readFileSync("node_modules/idb-opfs/dist/index.mjs", {encoding: "utf8"})

export test = base.extend({
  forEachTest: [async ({ page }, use) => {
    // Setup OPFS for WebKit
    await page.addInitScript(async (source) => {
      const mod = new Blob([source], { type: "application/javascript" })
      const url = URL.createObjectURL(mod)
      await import(url)
      URL.revokeObjectURL(url)
    }, idbOpfsSource)

    await use()
  }, { auto: true }]
})
```
