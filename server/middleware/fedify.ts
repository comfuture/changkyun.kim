import { getHeader, getRequestURL, readRawBody } from "h3"

import { createFedify, getCloudflareEnv } from "../utils/fedify"
import {
  FEDIFY_BLOG_CANONICAL_HOSTNAMES,
  FEDIFY_BLOG_COLLECTION_PREFIX,
  SITE_ORIGIN,
} from "../utils/fedifyContent"

const BLOG_HOSTS = new Set(Array.from(FEDIFY_BLOG_CANONICAL_HOSTNAMES, (host) => host.toLowerCase()))

function acceptsActivityPub(acceptHeader?: string | null): boolean {
  if (!acceptHeader) {
    return false
  }
  const normalized = acceptHeader.toLowerCase()
  return normalized.includes("application/activity+json")
    || normalized.includes("activity+json")
    || (normalized.includes("ld+json") && normalized.includes("activitystreams"))
    || (normalized.includes("json") && normalized.includes("profile=") && normalized.includes("activitystreams"))
}

function isFederationRequest(method: string, pathname: string, accept?: string | null): boolean {
  if (pathname.startsWith("/.well-known/nodeinfo")) {
    return true
  }
  if ((pathname === "/inbox" || pathname === "/@me/inbox") && method === "POST") {
    return true
  }
  if (pathname === "/@me" || pathname.startsWith("/@me/")) {
    return acceptsActivityPub(accept)
  }
  if ((pathname.startsWith("/blog/") || pathname.startsWith("/app/")) && acceptsActivityPub(accept)) {
    return true
  }
  if (pathname.endsWith("/activity") && acceptsActivityPub(accept)) {
    return true
  }
  return false
}

function toFedifyUrl(url: URL): URL {
  const fedifyUrl = new URL(url.href)
  fedifyUrl.protocol = "https:"
  fedifyUrl.host = new URL(SITE_ORIGIN).host

  const hostname = url.hostname.toLowerCase()
  if (BLOG_HOSTS.has(hostname)) {
    let pathname = url.pathname || "/"
    if (pathname !== "/" && pathname.endsWith("/")) {
      pathname = pathname.replace(/\/+$/, "")
    }
    if (pathname !== "/" && pathname !== FEDIFY_BLOG_COLLECTION_PREFIX && !pathname.startsWith(`${FEDIFY_BLOG_COLLECTION_PREFIX}/`)) {
      fedifyUrl.pathname = `${FEDIFY_BLOG_COLLECTION_PREFIX}${pathname}`
    }
  }

  return fedifyUrl
}

export default defineEventHandler(async (event) => {
  const url = getRequestURL(event)
  const accept = getHeader(event, "accept")

  if (!isFederationRequest(event.method, url.pathname, accept)) {
    return
  }

  const fedifyUrl = toFedifyUrl(url)
  const headers = new Headers(event.headers)
  headers.set("host", fedifyUrl.host)

  const body = event.method === "GET" || event.method === "HEAD"
    ? undefined
    : await readRawBody(event)

  const request = new Request(fedifyUrl, {
    method: event.method,
    headers,
    body,
  })

  const federation = await createFedify(getCloudflareEnv(event))
  return await federation.fetch(request, {
    contextData: { env: getCloudflareEnv(event) },
  })
})
