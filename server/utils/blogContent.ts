import { queryCollection, queryCollectionItemSurroundings } from "@nuxt/content/server"
import { createError } from "h3"
import type { H3Event } from "h3"

const BLOG_ARTICLE_SUMMARY_FIELDS = [
  "id",
  "path",
  "title",
  "description",
  "createdAt",
  "coverImage",
] as const

export function normalizeBlogContentPath(input: string): string {
  const value = input.trim()
  const pathname = /^https?:\/\//.test(value) ? new URL(value).pathname : value
  const normalized = pathname === "/" ? pathname : pathname.replace(/\/+$/, "")

  if (!normalized.startsWith("/blog/")) {
    throw createError({
      statusCode: 400,
      statusMessage: "Blog content path must start with /blog/.",
    })
  }

  return normalized
}

export async function listBlogArticles(event: H3Event, limit?: number) {
  const query = queryCollection(event, "blog")
    .select(...BLOG_ARTICLE_SUMMARY_FIELDS)
    .order("createdAt", "DESC")

  if (limit && limit > 0) {
    query.limit(limit)
  }

  return await query.all()
}

export async function getBlogArticle(event: H3Event, path: string) {
  const normalizedPath = normalizeBlogContentPath(path)
  const article = await queryCollection(event, "blog")
    .path(normalizedPath)
    .first()

  const surround = article
    ? await queryCollectionItemSurroundings(event, "blog", article.path || normalizedPath, {
        fields: ["title", "description"],
      })
    : []

  return {
    article,
    surround,
  }
}

export async function listBlogTags(event: H3Event) {
  const articles = await queryCollection(event, "blog")
    .select("tags")
    .all()
  const tags = new Set<string>()

  for (const article of articles) {
    if (!article.tags) {
      continue
    }
    for (const tag of article.tags) {
      tags.add(tag)
    }
  }

  return Array.from(tags).sort()
}
