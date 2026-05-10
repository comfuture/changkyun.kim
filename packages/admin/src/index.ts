import path from "node:path"
import process from "node:process"

import { parseArgs, usage } from "./args.ts"
import { runCommand } from "./commands.ts"
import { loadDefaultEnvFiles } from "./env.ts"
import {
  getFirstExistingFilePath,
  importPrivateKey,
  loadPrivateKeyFromFile,
  normalizePemText,
} from "./signing.ts"
import { runDashboard } from "./ui/dashboard.ts"

async function bootstrap(): Promise<void> {
  loadDefaultEnvFiles()

  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    usage()
    return
  }

  const privateKeyFilePath = getFirstExistingFilePath([
    options.privateKeyFile,
    path.resolve(process.cwd(), "activitypub-admin.key"),
    path.resolve(process.cwd(), ".activitypub-admin.key"),
  ].filter(Boolean))
  const privateKeyText = normalizePemText(options.privateKey || (privateKeyFilePath ? loadPrivateKeyFromFile(privateKeyFilePath) : ""))
  if (!privateKeyText) {
    process.stderr.write("ACTIVITYPUB_ADMIN_PRIVATE_KEY 또는 --private-key / --private-key-file를 설정해주세요.\n")
    process.exit(1)
  }

  const privateKey = await importPrivateKey(privateKeyText).catch((error) => {
    process.stderr.write(`${error?.message || error}\n`)
    process.exit(1)
  })
  const signConfig = {
    keyId: options.keyId,
    privateKey,
  }

  if (options.command) {
    await runCommand(options, signConfig)
    return
  }

  await runDashboard(options, signConfig)
}

bootstrap().catch((error) => {
  process.stderr.write(`admin cli failed: ${error?.message || error}\n`)
  process.exit(1)
})
