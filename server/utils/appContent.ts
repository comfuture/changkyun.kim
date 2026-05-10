import { queryCollection } from "@nuxt/content/server"
import { createError } from "h3"
import type { H3Event } from "h3"

export function normalizeAppContentPath(input: string): string {
  const value = input.trim()
  const pathname = /^https?:\/\//.test(value) ? new URL(value).pathname : value
  const normalized = pathname === "/" ? pathname : pathname.replace(/\/+$/, "")

  if (normalized !== "/app" && !normalized.startsWith("/app/")) {
    throw createError({
      statusCode: 400,
      statusMessage: "App content path must start with /app/.",
    })
  }

  return normalized
}

export async function getAppContent(event: H3Event, path: string) {
  return await queryCollection(event, "app")
    .path(normalizeAppContentPath(path))
    .first()
}
