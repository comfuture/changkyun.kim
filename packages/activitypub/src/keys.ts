// RSA key import/export helpers (Web Crypto, PEM).

const RSA_ALGORITHM = { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" } as const

export function base64Encode(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let binary = ""
  for (let index = 0; index < view.length; index += 0x8000) {
    binary += String.fromCharCode(...view.subarray(index, index + 0x8000))
  }
  return btoa(binary)
}

export function base64Decode(value: string): Uint8Array {
  const binary = atob(value.replace(/\s/g, ""))
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

function pemBody(pem: string, label: string): Uint8Array | null {
  const pattern = new RegExp(`-----BEGIN ${label}-----([\\s\\S]+?)-----END ${label}-----`)
  const match = pattern.exec(pem)
  return match?.[1] ? base64Decode(match[1]) : null
}

function derLength(length: number): number[] {
  if (length < 0x80) {
    return [length]
  }
  const bytes: number[] = []
  let remaining = length
  while (remaining > 0) {
    bytes.unshift(remaining & 0xff)
    remaining >>= 8
  }
  return [0x80 | bytes.length, ...bytes]
}

function derSequence(tag: number, content: Uint8Array): Uint8Array {
  const header = [tag, ...derLength(content.length)]
  const result = new Uint8Array(header.length + content.length)
  result.set(header)
  result.set(content, header.length)
  return result
}

// AlgorithmIdentifier { rsaEncryption, NULL }
const RSA_ALGORITHM_IDENTIFIER = new Uint8Array([
  0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00,
])

/** Wraps a PKCS#1 RSAPublicKey in a SubjectPublicKeyInfo structure. */
function pkcs1ToSpki(pkcs1: Uint8Array): Uint8Array {
  const bitString = derSequence(0x03, new Uint8Array([0x00, ...pkcs1]))
  const content = new Uint8Array(RSA_ALGORITHM_IDENTIFIER.length + bitString.length)
  content.set(RSA_ALGORITHM_IDENTIFIER)
  content.set(bitString, RSA_ALGORITHM_IDENTIFIER.length)
  return derSequence(0x30, content)
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

/** Imports an RSA public key from SPKI (`PUBLIC KEY`) or PKCS#1 (`RSA PUBLIC KEY`) PEM. */
export async function importPublicKeyPem(pem: string): Promise<CryptoKey> {
  const spki = pemBody(pem, "PUBLIC KEY")
  if (spki) {
    return await crypto.subtle.importKey("spki", toArrayBuffer(spki), RSA_ALGORITHM, true, ["verify"])
  }
  const pkcs1 = pemBody(pem, "RSA PUBLIC KEY")
  if (pkcs1) {
    return await crypto.subtle.importKey("spki", toArrayBuffer(pkcs1ToSpki(pkcs1)), RSA_ALGORITHM, true, ["verify"])
  }
  throw new TypeError("Unsupported public key PEM format.")
}

/** Imports an RSA private key from PKCS#8 (`PRIVATE KEY`) PEM. */
export async function importPrivateKeyPem(pem: string): Promise<CryptoKey> {
  const pkcs8 = pemBody(pem, "PRIVATE KEY")
  if (!pkcs8) {
    throw new TypeError("Unsupported private key PEM format.")
  }
  return await crypto.subtle.importKey("pkcs8", toArrayBuffer(pkcs8), RSA_ALGORITHM, false, ["sign"])
}

export async function exportPublicKeyPem(key: CryptoKey): Promise<string> {
  const spki = new Uint8Array(await crypto.subtle.exportKey("spki", key))
  const lines = base64Encode(spki).match(/.{1,64}/g) ?? []
  return `-----BEGIN PUBLIC KEY-----\n${lines.join("\n")}\n-----END PUBLIC KEY-----\n`
}

export async function signBytes(privateKey: CryptoKey, data: string): Promise<string> {
  const signature = await crypto.subtle.sign(RSA_ALGORITHM.name, privateKey, new TextEncoder().encode(data))
  return base64Encode(signature)
}

export async function verifyBytes(publicKey: CryptoKey, data: string, signature: string): Promise<boolean> {
  let bytes: Uint8Array
  try {
    bytes = base64Decode(signature)
  } catch {
    return false
  }
  return await crypto.subtle.verify(RSA_ALGORITHM.name, publicKey, toArrayBuffer(bytes), new TextEncoder().encode(data))
}

export async function sha256(data: string | Uint8Array | ArrayBuffer): Promise<Uint8Array> {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data instanceof Uint8Array ? data : new Uint8Array(data)
  return new Uint8Array(await crypto.subtle.digest("SHA-256", toArrayBuffer(bytes)))
}

export async function sha256Hex(data: string): Promise<string> {
  return Array.from(await sha256(data), (byte) => byte.toString(16).padStart(2, "0")).join("")
}
