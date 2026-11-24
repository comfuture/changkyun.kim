// Module resolution hooks that let plain `node --test` import the Nitro server
// sources: extensionless relative TypeScript imports, Nuxt virtual modules and
// JSON imports without import attributes.
import { existsSync, statSync } from "node:fs"
import { fileURLToPath, pathToFileURL } from "node:url"

const stubsDir = new URL("./stubs/", import.meta.url)

const ALIASES = {
  "#content/manifest": new URL("content-manifest.mjs", stubsDir).href,
  "#content-dump-generated": new URL("content-dump.mjs", stubsDir).href,
  "@nuxt/content/server": new URL("content-server.mjs", stubsDir).href,
}

function isFile(path) {
  try {
    return statSync(path).isFile()
  } catch {
    return false
  }
}

export async function resolve(specifier, context, nextResolve) {
  if (Object.hasOwn(ALIASES, specifier)) {
    return { url: ALIASES[specifier], shortCircuit: true }
  }

  const parent = context.parentURL ?? ""
  const isProjectParent = parent.startsWith("file:") && !parent.includes("/node_modules/")
  if (isProjectParent && (specifier.startsWith("./") || specifier.startsWith("../"))) {
    const target = new URL(specifier, parent)
    const path = fileURLToPath(target)
    if (path.endsWith(".json") && existsSync(path)) {
      return {
        url: target.href,
        format: "json",
        importAttributes: { type: "json" },
        shortCircuit: true,
      }
    }
    if (!isFile(path)) {
      for (const candidate of [`${path}.ts`, `${path}.mjs`, `${path}/index.ts`]) {
        if (isFile(candidate)) {
          return { url: pathToFileURL(candidate).href, shortCircuit: true }
        }
      }
    }
  }

  return nextResolve(specifier, context)
}
