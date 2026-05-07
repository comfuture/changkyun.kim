import { ACTOR_IDENTIFIER, SITE_ORIGIN } from "../../utils/fedifyContent"

const HANDLE_HOST = new URL(SITE_ORIGIN).host
const ACTOR_URL = new URL(`/@${ACTOR_IDENTIFIER}`, SITE_ORIGIN).href
const ACCOUNT = `acct:${ACTOR_IDENTIFIER}@${HANDLE_HOST}`
const LEGACY_ACCOUNTS = [`acct:changkyun.kim@${HANDLE_HOST}`] as const
const KNOWN_RESOURCES = new Set<string>([
  ACCOUNT,
  ACTOR_URL,
  ...LEGACY_ACCOUNTS,
].map((resource) => resource.toLowerCase()))

function isKnownResource(resource: unknown): boolean {
  if (typeof resource !== "string") {
    return false
  }
  return KNOWN_RESOURCES.has(resource.toLowerCase())
}

export default defineEventHandler((event) => {
  const { resource } = getQuery(event)
  if (!isKnownResource(resource)) {
    throw createError({ statusCode: 404, statusMessage: "Not Found" })
  }

  setResponseHeader(event, "Access-Control-Allow-Origin", "*")
  setResponseHeader(event, "Content-Type", "application/jrd+json; charset=utf-8")

  return {
    subject: ACCOUNT,
    aliases: [ACTOR_URL, ...LEGACY_ACCOUNTS],
    links: [
      {
        rel: "self",
        type: "application/activity+json",
        href: ACTOR_URL,
      },
      {
        rel: "http://webfinger.net/rel/profile-page",
        href: new URL("/about", SITE_ORIGIN).href,
      },
      {
        rel: "http://webfinger.net/rel/avatar",
        type: "image/jpeg",
        href: new URL("/image/avatar.jpg", SITE_ORIGIN).href,
      },
    ],
  }
})
