import fs from "node:fs"

export function loadPrivateKeyFromFile(filePath: string): string {
  if (!filePath) {
    return ""
  }
  return fs.readFileSync(filePath, "utf8")
}

export function normalizePemText(value: string): string {
  return (value || "").replace(/\r?\n/g, "\n").trim()
}

export function getFirstExistingFilePath(paths: string[]): string {
  for (const candidate of paths) {
    try {
      if (fs.existsSync(candidate)) {
        return candidate
      }
    } catch {
      // ignore
    }
  }
  return ""
}

export async function importPrivateKey(pemText: string): Promise<CryptoKey> {
  const pem = (pemText || "").trim()
  if (!pem.includes("-----BEGIN PRIVATE KEY-----") || !pem.includes("-----END PRIVATE KEY-----")) {
    throw new Error("private key는 PKCS#8 PEM 형식이어야 합니다.")
  }
  const header = "-----BEGIN PRIVATE KEY-----"
  const footer = "-----END PRIVATE KEY-----"
  const body = pem
    .replace(header, "")
    .replace(footer, "")
    .replace(/\s/g, "")
  const binaryDer = Buffer.from(body, "base64")
  return crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: { name: "SHA-256" },
    },
    false,
    ["sign"],
  )
}

async function createDigest(value: string): Promise<string> {
  const encoder = new TextEncoder()
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(value))
  return `SHA-256=${Buffer.from(hashBuffer).toString("base64")}`
}

function buildSigningString(
  method: string,
  path: string,
  headerValues: Record<string, string | undefined>,
  signedHeaders: string[],
): string {
  return signedHeaders
    .map((header) => {
      if (header === "(request-target)") {
        return `(request-target): ${method.toLowerCase()} ${path}`
      }
      return `${header}: ${headerValues[header]}`
    })
    .join("\n")
}

function createSignatureHeader(signingText: string, headers: string[], keyId: string): string {
  return `keyId="${keyId}",headers="${headers.join(" ")}",signature="${signingText}"`
}

export async function createSignedHeaders(
  endpoint: string,
  method: "GET" | "POST",
  payload: unknown,
  keyId: string,
  key: CryptoKey,
): Promise<{ date: string; digest?: string; signature: string }> {
  const requestUrl = new URL(endpoint)
  const path = `${requestUrl.pathname}${requestUrl.search}`
  const normalized = method.toLowerCase()
  const bodyText = payload == null ? "" : JSON.stringify(payload)
  const headers: { host: string; date: string; digest?: string } = {
    host: requestUrl.host,
    date: new Date().toUTCString(),
  }

  const signingHeaders = ["(request-target)", "host", "date"]
  const headerValues: Record<string, string | undefined> = {
    host: headers.host,
    date: headers.date,
  }

  if (bodyText) {
    headers.digest = await createDigest(bodyText)
    headerValues.digest = headers.digest
    signingHeaders.push("digest")
  }

  const signingText = buildSigningString(normalized, path, headerValues, signingHeaders)
  const signature = await crypto.subtle.sign(
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: { name: "SHA-256" },
    },
    key,
    new TextEncoder().encode(signingText),
  )

  const signatureHeader = createSignatureHeader(Buffer.from(signature).toString("base64"), signingHeaders, keyId)
  return {
    date: headers.date,
    digest: headers.digest,
    signature: signatureHeader,
  }
}
