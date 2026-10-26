// Lets `node --test` load the TypeScript sources: maps `@shared/*` and extensionless relative imports to `.ts` files.
import { registerHooks } from 'node:module'
import { existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve as resolvePath } from 'node:path'

const shared = resolvePath(dirname(fileURLToPath(import.meta.url)), '../src/shared')

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('@shared/')) return next(pathToFileURL(`${shared}/${specifier.slice(8)}.ts`).href, context)
    if (specifier.startsWith('.') && !/\.[cm]?[jt]s$/.test(specifier) && context.parentURL?.startsWith('file:')) {
      const candidate = resolvePath(dirname(fileURLToPath(context.parentURL)), `${specifier}.ts`)
      if (existsSync(candidate)) return next(pathToFileURL(candidate).href, context)
    }
    return next(specifier, context)
  }
})
