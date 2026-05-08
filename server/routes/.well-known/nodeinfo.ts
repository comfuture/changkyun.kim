import { SITE_ORIGIN } from "../../utils/fedifyContent"

const NODEINFO_SCHEMA_REL = "http://nodeinfo.diaspora.software/ns/schema/2.1"
const NODEINFO_CONTENT_TYPE = "application/json; profile=\"http://nodeinfo.diaspora.software/ns/schema/2.1#\""

export default defineEventHandler((event) => {
  setResponseHeader(event, "Access-Control-Allow-Origin", "*")
  setResponseHeader(event, "Content-Type", "application/jrd+json; charset=utf-8")

  return {
    links: [
      {
        rel: NODEINFO_SCHEMA_REL,
        href: new URL("/nodeinfo/2.1", SITE_ORIGIN).href,
        type: NODEINFO_CONTENT_TYPE,
      },
    ],
  }
})
