import { Temporal as TemporalPolyfill } from "@js-temporal/polyfill"
import {
  Article,
  Create,
  Hashtag,
  PUBLIC_COLLECTION,
  Source,
} from "@fedify/vocab"
import { toHtml } from "hast-util-to-html"
import { toHast } from "minimark/hast"
import { stringify as stringifyMinimark } from "minimark/stringify"

export const ACTOR_IDENTIFIER = "me"
export const SITE_ORIGIN = "https://changkyun.kim"
export const FEDIFY_BLOG_COLLECTION_PREFIX = "/blog"
export const FEDIFY_BLOG_CANONICAL_HOSTNAMES = ["changkyun.blog", "www.changkyun.blog"] as const
export const FEDIFY_BLOG_CANONICAL_ORIGIN = "https://changkyun.blog"
export const FEDIFY_OUTBOX_PAGE_SIZE = 20

export type FedifyContentEntry = {
  id?: string | null
  _id?: string | null
  path?: string | null
  _path?: string | null
  body?: any
  title?: string | null
  stem?: string | null
  description?: string | null
  createdAt?: string | Date | null
  draft?: boolean | null
  tags?: string[] | null
}

type FedifyCollection = "blog" | "app"

type ContentRow = {
  id?: string | null
  title?: string | null
  body?: unknown
  coverImage?: string | null
  createdAt?: string | Date | null
  description?: string | null
  extension?: string | null
  meta?: unknown
  navigation?: unknown
  path?: string | null
  seo?: unknown
  stem?: string | null
  tags?: unknown
}

function getContentTable(collection: FedifyCollection): "_content_blog" | "_content_app" {
  return collection === "blog" ? "_content_blog" : "_content_app"
}

function toFedifyContentEntry(row: ContentRow): FedifyContentEntry {
  const meta = parseJsonField(row.meta) as Record<string, unknown> | null
  return {
    id: row.id ?? null,
    _id: row.id ?? null,
    path: row.path ?? null,
    _path: row.path ?? null,
    body: parseJsonField(row.body),
    title: row.title ?? null,
    stem: row.stem ?? null,
    description: row.description ?? null,
    createdAt: row.createdAt ?? null,
    draft: Boolean(meta && typeof meta === "object" && meta.draft === true),
    tags: normalizeTags(row.tags),
  }
}

export async function fetchFedifyContentEntry(collection: FedifyCollection, path: string): Promise<FedifyContentEntry | null> {
  const db = useDatabase()
  const normalizedPath = normalizeArticlePath(path)
  const { rows } = getContentTable(collection) === "_content_blog"
    ? await db.sql`
      SELECT id, title, body, coverImage, createdAt, description, extension, meta, navigation, path, seo, stem, tags
      FROM _content_blog
      WHERE path = ${normalizedPath}
        AND createdAt IS NOT NULL
        AND datetime(createdAt) IS NOT NULL
        AND json_extract(meta, '$.draft') IS NOT TRUE
      LIMIT 1
    `
    : await db.sql`
      SELECT id, title, body, coverImage, createdAt, description, extension, meta, navigation, path, seo, stem, tags
      FROM _content_app
      WHERE path = ${normalizedPath}
        AND createdAt IS NOT NULL
        AND datetime(createdAt) IS NOT NULL
        AND json_extract(meta, '$.draft') IS NOT TRUE
      LIMIT 1
    `
  const row = rows?.[0] as ContentRow | undefined
  return row ? toFedifyContentEntry(row) : null
}

export async function fetchFedifyContentEntries(collection: FedifyCollection, options: {
  order?: "ASC" | "DESC"
  createdAtGte?: string | null
} = {}): Promise<FedifyContentEntry[]> {
  const db = useDatabase()
  const order = options.order === "ASC" ? "ASC" : "DESC"
  const since = options.createdAtGte ?? null

  const result = getContentTable(collection) === "_content_blog"
    ? since
      ? order === "ASC"
        ? await db.sql`
          SELECT id, title, body, coverImage, createdAt, description, extension, meta, navigation, path, seo, stem, tags
          FROM _content_blog
          WHERE createdAt >= ${since}
            AND createdAt IS NOT NULL
            AND datetime(createdAt) IS NOT NULL
            AND json_extract(meta, '$.draft') IS NOT TRUE
          ORDER BY createdAt ASC, path ASC
        `
        : await db.sql`
          SELECT id, title, body, coverImage, createdAt, description, extension, meta, navigation, path, seo, stem, tags
          FROM _content_blog
          WHERE createdAt >= ${since}
            AND createdAt IS NOT NULL
            AND datetime(createdAt) IS NOT NULL
            AND json_extract(meta, '$.draft') IS NOT TRUE
          ORDER BY createdAt DESC, path DESC
        `
      : order === "ASC"
        ? await db.sql`
          SELECT id, title, body, coverImage, createdAt, description, extension, meta, navigation, path, seo, stem, tags
          FROM _content_blog
          WHERE createdAt IS NOT NULL
            AND datetime(createdAt) IS NOT NULL
            AND json_extract(meta, '$.draft') IS NOT TRUE
          ORDER BY createdAt ASC, path ASC
        `
        : await db.sql`
          SELECT id, title, body, coverImage, createdAt, description, extension, meta, navigation, path, seo, stem, tags
          FROM _content_blog
          WHERE createdAt IS NOT NULL
            AND datetime(createdAt) IS NOT NULL
            AND json_extract(meta, '$.draft') IS NOT TRUE
          ORDER BY createdAt DESC, path DESC
        `
    : since
      ? order === "ASC"
        ? await db.sql`
          SELECT id, title, body, coverImage, createdAt, description, extension, meta, navigation, path, seo, stem, tags
          FROM _content_app
          WHERE createdAt >= ${since}
            AND createdAt IS NOT NULL
            AND datetime(createdAt) IS NOT NULL
            AND json_extract(meta, '$.draft') IS NOT TRUE
          ORDER BY createdAt ASC, path ASC
        `
        : await db.sql`
          SELECT id, title, body, coverImage, createdAt, description, extension, meta, navigation, path, seo, stem, tags
          FROM _content_app
          WHERE createdAt >= ${since}
            AND createdAt IS NOT NULL
            AND datetime(createdAt) IS NOT NULL
            AND json_extract(meta, '$.draft') IS NOT TRUE
          ORDER BY createdAt DESC, path DESC
        `
      : order === "ASC"
        ? await db.sql`
          SELECT id, title, body, coverImage, createdAt, description, extension, meta, navigation, path, seo, stem, tags
          FROM _content_app
          WHERE createdAt IS NOT NULL
            AND datetime(createdAt) IS NOT NULL
            AND json_extract(meta, '$.draft') IS NOT TRUE
          ORDER BY createdAt ASC, path ASC
        `
        : await db.sql`
          SELECT id, title, body, coverImage, createdAt, description, extension, meta, navigation, path, seo, stem, tags
          FROM _content_app
          WHERE createdAt IS NOT NULL
            AND datetime(createdAt) IS NOT NULL
            AND json_extract(meta, '$.draft') IS NOT TRUE
          ORDER BY createdAt DESC, path DESC
        `

  return ((result.rows ?? []) as ContentRow[])
    .map(toFedifyContentEntry)
}

function ensureLeadingSlash(value: string): string {
  if (!value) {
    return "/"
  }
  return value.startsWith("/") ? value : `/${value}`
}

function stripTrailingSlash(value: string): string {
  if (value.length > 1 && value.endsWith("/")) {
    return value.replace(/\/+$/, "") || "/"
  }
  return value
}

export function normalizeArticlePath(path: string): string {
  return stripTrailingSlash(ensureLeadingSlash(path))
}

function normalizeRelativePath(path: string): string {
  const normalized = stripTrailingSlash(ensureLeadingSlash(path))
  return normalized === "/" ? "/" : normalized
}

function parseJsonField(value: unknown): unknown {
  if (typeof value !== "string") {
    return value
  }
  const trimmed = value.trim()
  if (!trimmed || (!trimmed.startsWith("{") && !trimmed.startsWith("["))) {
    return value
  }
  try {
    return JSON.parse(trimmed)
  } catch {
    return value
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function normalizeTags(value: unknown): string[] {
  const parsed = parseJsonField(value)
  if (!Array.isArray(parsed)) {
    return []
  }

  const tags = new Set<string>()
  for (const item of parsed) {
    if (typeof item !== "string") {
      continue
    }
    const tag = item.trim().replace(/^#+/, "")
    if (tag) {
      tags.add(tag)
    }
  }
  return Array.from(tags)
}

function buildHashtags(tags?: string[] | null): Hashtag[] {
  return (tags ?? []).flatMap((tag) => {
    const normalized = tag.trim().replace(/^#+/, "")
    if (!normalized) {
      return []
    }
    return [
      new Hashtag({
        name: `#${normalized}`,
        href: new URL(`/blog/tag/${encodeURIComponent(normalized)}`, SITE_ORIGIN),
      }),
    ]
  })
}

function stringifyMinimarkSafe(tree: any): string {
  try {
    return stringifyMinimark(tree) || ""
  } catch (error) {
    console.error("Failed to stringify minimark content for ActivityPub", error)
    return ""
  }
}

function normalizeHastForHtml(node: any): any {
  if (!node || typeof node !== "object") {
    return node
  }
  if (node.type === "root") {
    return {
      type: "root",
      children: Array.isArray(node.children) ? node.children.map(normalizeHastForHtml) : [],
    }
  }
  if (node.type === "element") {
    return {
      type: "element",
      tagName: node.tagName ?? node.tag,
      properties: node.properties ?? node.props ?? {},
      children: Array.isArray(node.children) ? node.children.map(normalizeHastForHtml) : [],
    }
  }
  if (node.type === "text" || node.type === "comment" || node.type === "raw") {
    return {
      type: node.type,
      value: node.value ?? "",
    }
  }
  return node
}

function renderMinimarkHtmlSafe(tree: any): string {
  try {
    return toHtml(normalizeHastForHtml(toHast(tree)), { allowDangerousHtml: true }) || ""
  } catch (error) {
    console.error("Failed to render minimark content for ActivityPub", error)
    return ""
  }
}

export function resolveEntryPath(entry: FedifyContentEntry): string | null {
  const path = entry.path || entry._path || entry.id || entry._id
  if (!path) {
    return null
  }
  return normalizeArticlePath(path)
}

export function resolveArticleUrl(entry: FedifyContentEntry): URL | null {
  const path = resolveEntryPath(entry)
  if (!path) {
    return null
  }
  return new URL(path, SITE_ORIGIN)
}

function resolvePublicArticleUrl(entry: FedifyContentEntry): URL | null {
  const path = resolveEntryPath(entry)
  if (!path) {
    return null
  }
  if (path === FEDIFY_BLOG_COLLECTION_PREFIX || path.startsWith(`${FEDIFY_BLOG_COLLECTION_PREFIX}/`)) {
    const relative = normalizeRelativePath(path.slice(FEDIFY_BLOG_COLLECTION_PREFIX.length) || "/")
    if (relative === "/") {
      return new URL("/", FEDIFY_BLOG_CANONICAL_ORIGIN)
    }
    return new URL(relative, FEDIFY_BLOG_CANONICAL_ORIGIN)
  }
  return new URL(path, SITE_ORIGIN)
}

function resolveLegacyArticleUrls(entry: FedifyContentEntry, canonicalUrl: URL): URL[] {
  const legacy = new Set<string>()
  const path = resolveEntryPath(entry)
  if (!path) {
    return []
  }

  const defaultUrl = new URL(path, SITE_ORIGIN)
  if (defaultUrl.href !== canonicalUrl.href) {
    legacy.add(defaultUrl.href)
  }

  const publicUrl = resolvePublicArticleUrl(entry)
  if (publicUrl && publicUrl.href !== canonicalUrl.href) {
    legacy.add(publicUrl.href)
  }

  if (path === FEDIFY_BLOG_COLLECTION_PREFIX || path.startsWith(`${FEDIFY_BLOG_COLLECTION_PREFIX}/`)) {
    const prefixed = new URL(path, FEDIFY_BLOG_CANONICAL_ORIGIN)
    if (prefixed.href !== canonicalUrl.href) {
      legacy.add(prefixed.href)
    }
  }

  return Array.from(legacy, (url) => new URL(url))
}

function normalizeDate(value?: string | Date | null): Temporal.Instant {
  const instantFromIso = (iso: string): Temporal.Instant => TemporalPolyfill.Instant.from(iso) as unknown as Temporal.Instant
  const fallback = instantFromIso(new Date().toISOString())
  if (!value) {
    return fallback
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? fallback : instantFromIso(value.toISOString())
  }
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? fallback : instantFromIso(parsed.toISOString())
}

export function resolveFedifyActivityId(articleUrl: URL | string): URL {
  const href = typeof articleUrl === "string" ? articleUrl : articleUrl.href
  const normalized = href.endsWith("/") && href.length > 1 ? href.slice(0, -1) : href
  return new URL(`${normalized}/activity`)
}

function appendLegacyActivityIds(collection: Set<string>, baseUrl: URL | string) {
  const href = typeof baseUrl === "string" ? baseUrl : baseUrl.href
  const normalized = stripTrailingSlash(href)
  collection.add(`${normalized}#create`)
  collection.add(`${normalized}#activity`)
  collection.add(`${normalized}/activity`)
}

export function resolveFedifyLegacyActivityIds(articleUrl: URL | string, entry?: FedifyContentEntry | null): string[] {
  const candidates = new Set<string>()
  appendLegacyActivityIds(candidates, articleUrl)

  if (entry) {
    const canonicalUrl = resolveArticleUrl(entry)
    const legacyUrls = resolveLegacyArticleUrls(entry, canonicalUrl ?? new URL(articleUrl))
    for (const legacyUrl of legacyUrls) {
      appendLegacyActivityIds(candidates, legacyUrl)
    }
  }

  return Array.from(candidates)
}

export async function buildArticleFromEntry(entry: FedifyContentEntry): Promise<Article | null> {
  const articleUrl = resolveArticleUrl(entry)
  if (!articleUrl) {
    return null
  }

  const publicUrl = resolvePublicArticleUrl(entry)
  let markdown = ""
  let contentHtml = ""
  const body = parseJsonField(entry?.body)
  if (typeof body === "string") {
    markdown = body
  } else if (isRecord(body) && body.type === "minimark") {
    markdown = stringifyMinimarkSafe(body)
    contentHtml = renderMinimarkHtmlSafe(body)
  }

  const urlCandidates: URL[] = [articleUrl]
  if (publicUrl && publicUrl.href !== articleUrl.href) {
    urlCandidates.push(publicUrl)
  }
  for (const legacyUrl of resolveLegacyArticleUrls(entry, articleUrl)) {
    if (legacyUrl.href !== articleUrl.href) {
      urlCandidates.push(legacyUrl)
    }
  }

  return new Article({
    id: articleUrl,
    attribution: new URL(`/@${ACTOR_IDENTIFIER}`, SITE_ORIGIN),
    content: contentHtml || markdown,
    mediaType: contentHtml ? "text/html" : markdown ? "text/markdown" : null,
    name: entry?.title || entry?.stem || articleUrl.href,
    published: normalizeDate(entry?.createdAt),
    summary: entry?.description || null,
    tags: buildHashtags(entry?.tags),
    urls: Array.from(new Map(urlCandidates.map((url) => [url.href, url])).values()),
    to: PUBLIC_COLLECTION,
    source: markdown
      ? new Source({
        content: markdown,
        mediaType: "text/markdown",
      })
      : null,
  })
}

export async function buildCreateFromEntry(entry: FedifyContentEntry): Promise<Create | null> {
  const article = await buildArticleFromEntry(entry)
  if (!article?.id) {
    return null
  }

  return new Create({
    id: resolveFedifyActivityId(article.id),
    actor: new URL(`/@${ACTOR_IDENTIFIER}`, SITE_ORIGIN),
    object: article,
    published: article.published,
    to: PUBLIC_COLLECTION,
  })
}

export async function collectCreateActivities(options: {
  limit?: number | null
  offset?: number
} = {}): Promise<{ totalItems: number; items: Create[] }> {
  const limit = typeof options.limit === "number" && Number.isFinite(options.limit)
    ? Math.max(0, options.limit)
    : options.limit === null
      ? null
      : FEDIFY_OUTBOX_PAGE_SIZE
  const offset = Math.max(0, options.offset ?? 0)

  const [blogEntries, appEntries] = await Promise.all([
    fetchFedifyContentEntries("blog", { order: "DESC" }),
    fetchFedifyContentEntries("app", { order: "DESC" }),
  ])

  const sortedEntries = [...(blogEntries ?? []), ...(appEntries ?? [])]
    .sort((a, b) => {
      const aDate = a?.createdAt ? new Date(a.createdAt).getTime() : 0
      const bDate = b?.createdAt ? new Date(b.createdAt).getTime() : 0
      return bDate - aDate
    })

  const totalItems = sortedEntries.length
  const end = typeof limit === "number" ? Math.min(totalItems, offset + limit) : totalItems
  const entries = sortedEntries
    .slice(offset, end)

  const activities: Create[] = []
  for (const entry of entries) {
    const activity = await buildCreateFromEntry(entry)
    if (activity) {
      activities.push(activity)
    }
  }

  return {
    totalItems,
    items: activities,
  }
}
