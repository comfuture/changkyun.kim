#!/usr/bin/env node

import { spawnSync } from "node:child_process"
import { dirname, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const binDir = dirname(fileURLToPath(import.meta.url))
const entry = resolve(binDir, "../src/index.ts")
const tsxLoader = resolve(binDir, "../node_modules/tsx/dist/loader.mjs")
const result = spawnSync(process.execPath, ["--import", pathToFileURL(tsxLoader).href, entry, ...process.argv.slice(2)], {
  stdio: "inherit",
})

if (result.error) {
  process.stderr.write(`${result.error.message}\n`)
}
process.exit(result.status ?? 1)
