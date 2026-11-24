import { generateKeyPairSync } from "node:crypto"

import { DocumentLoader, MemoryKvStore, importPrivateKeyPem, type SigningKey } from "../src/index.ts"

export type RecordedRequest = {
  method: string
  url: string
  headers: Headers
  body: string
}

export type Route = (request: Request, body: string) => Response | Promise<Response>

/** Tiny fetch router; unknown URLs return 404. */
export class FakeNetwork {
  routes = new Map<string, Route>()
  requests: RecordedRequest[] = []

  json(url: string, body: unknown, status = 200, contentType = "application/activity+json") {
    this.routes.set(url, () => new Response(JSON.stringify(body), { status, headers: { "content-type": contentType } }))
  }

  route(url: string, route: Route) {
    this.routes.set(url, route)
  }

  fetch: typeof fetch = async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init)
    const body = request.method === "GET" || request.method === "HEAD" ? "" : await request.clone().text()
    const url = request.url.replace(/#.*$/, "")
    this.requests.push({ method: request.method, url, headers: request.headers, body })
    const route = this.routes.get(url)
    return route ? await route(request, body) : new Response("not found", { status: 404 })
  }
}

export type TestKeyPair = {
  publicKeyPem: string
  privateKeyPem: string
  pkcs1PublicKeyPem: string
}

export function generateTestKeyPair(): TestKeyPair {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 })
  return {
    publicKeyPem: publicKey.export({ type: "spki", format: "pem" }).toString(),
    privateKeyPem: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    pkcs1PublicKeyPem: publicKey.export({ type: "pkcs1", format: "pem" }).toString(),
  }
}

export async function signingKey(keyId: string, pair: TestKeyPair): Promise<SigningKey> {
  return { keyId, privateKey: await importPrivateKeyPem(pair.privateKeyPem) }
}

export function actorDocument(id: string, pair: TestKeyPair, extra: Record<string, unknown> = {}) {
  return {
    "@context": ["https://www.w3.org/ns/activitystreams", "https://w3id.org/security/v1"],
    id,
    type: "Person",
    preferredUsername: id.split("/").pop(),
    inbox: `${id}/inbox`,
    publicKey: { id: `${id}#main-key`, owner: id, publicKeyPem: pair.publicKeyPem },
    ...extra,
  }
}

export function createLoader(network: FakeNetwork, options: Partial<ConstructorParameters<typeof DocumentLoader>[0]> = {}) {
  return new DocumentLoader({
    userAgent: "test-agent/1.0",
    kv: new MemoryKvStore(),
    fetch: network.fetch,
    ...options,
  })
}
