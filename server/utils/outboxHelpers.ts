import type { H3Event } from 'h3'

import { stringifyMarkdown } from '@nuxtjs/mdc/runtime'
import { stringify as stringifyMinimark } from 'minimark/stringify'
import { toHtml } from 'hast-util-to-html'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'

import { me, PUBLIC_AUDIENCE } from './federation'

export const BLOG_COLLECTION_PREFIX = '/blog'
export const BLOG_CANONICAL_HOSTNAMES = ['changkyun.blog', 'www.changkyun.blog'] as const
export const BLOG_CANONICAL_ORIGIN = 'https://changkyun.blog'

function ensureLeadingSlash(value: string): string {
  if (!value) {
    return '/'
  }
  return value.startsWith('/') ? value : `/${value}`
}

function stripTrailingSlash(value: string): string {
  if (value.length > 1 && value.endsWith('/')) {
    return value.replace(/\/+$/, '') || '/'
  }
  return value
}

function normalizeArticlePath(path: string): string {
  return stripTrailingSlash(ensureLeadingSlash(path))
}

function normalizeRelativePath(path: string): string {
  const normalized = stripTrailingSlash(ensureLeadingSlash(path))
  return normalized === '/' ? '/' : normalized
}

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype, { allowDangerousHtml: true })

const siteOrigin = new URL(me.id).origin

export const CONTENT_CONTEXT = 'https://www.w3.org/ns/activitystreams'
export const OUTBOX_PAGE_SIZE = 20

export type ContentEntry = {
  id?: string | null
  _id?: string | null
  path?: string | null
  _path?: string | null
  body?: any
  title?: string | null
  stem?: string | null
  description?: string | null
  createdAt?: string | Date | null
}

async function renderMarkdown(markdown: string): Promise<string> {
  if (!markdown) {
    return ''
  }
  const tree = processor.parse(markdown)
  const result = await processor.run(tree)
  return toHtml(result, { allowDangerousHtml: true })
}

function resolveEntryPath(entry: ContentEntry): string | null {
  const path = entry.path || entry._path || entry.id || entry._id
  if (!path) {
    return null
  }
  return normalizeArticlePath(path)
}

function resolveArticleUrl(entry: ContentEntry): string | null {
  const path = resolveEntryPath(entry)
  if (!path) {
    return null
  }
  if (path === BLOG_COLLECTION_PREFIX || path.startsWith(`${BLOG_COLLECTION_PREFIX}/`)) {
    const relative = normalizeRelativePath(path.slice(BLOG_COLLECTION_PREFIX.length) || '/')
    if (relative === '/') {
      return `${BLOG_CANONICAL_ORIGIN}/`
    }
    return `${BLOG_CANONICAL_ORIGIN}${relative}`
  }
  return `${siteOrigin}${path}`
}

function resolveLegacyArticleUrls(entry: ContentEntry, canonicalUrl: string): string[] {
  const legacy = new Set<string>()
  const path = resolveEntryPath(entry)
  if (!path) {
    return []
  }

  const defaultUrl = `${siteOrigin}${path}`
  if (defaultUrl !== canonicalUrl) {
    legacy.add(defaultUrl)
  }

  if (path === BLOG_COLLECTION_PREFIX || path.startsWith(`${BLOG_COLLECTION_PREFIX}/`)) {
    const prefixed = `${BLOG_CANONICAL_ORIGIN}${path}`
    if (prefixed !== canonicalUrl) {
      legacy.add(prefixed)
    }
  }

  return Array.from(legacy)
}

function normalizeDate(value?: string | Date | null): string {
  if (!value) {
    return new Date().toISOString()
  }
  if (value instanceof Date) {
    return value.toISOString()
  }
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString()
}

export function resolveActivityId(articleUrl: string): string {
  const normalized = articleUrl.endsWith('/') && articleUrl.length > 1
    ? articleUrl.slice(0, -1)
    : articleUrl
  return `${normalized}/activity`
}

function appendLegacyActivityIds(collection: Set<string>, baseUrl: string) {
  const normalized = stripTrailingSlash(baseUrl)
  collection.add(`${normalized}#create`)
  collection.add(`${normalized}#activity`)
  collection.add(`${normalized}/activity`)
}

export function resolveLegacyActivityIds(articleUrl: string, entry?: ContentEntry | null): string[] {
  const candidates = new Set<string>()
  appendLegacyActivityIds(candidates, articleUrl)

  if (entry) {
    const canonicalUrl = resolveArticleUrl(entry)
    const legacyUrls = resolveLegacyArticleUrls(entry, canonicalUrl ?? articleUrl)
    for (const legacyUrl of legacyUrls) {
      appendLegacyActivityIds(candidates, legacyUrl)
    }
  }

  return Array.from(candidates)
}

export async function buildArticleObjectFromEntry(entry: ContentEntry): Promise<ObjectT | null> {
  const articleUrl = resolveArticleUrl(entry)
  if (!articleUrl) {
    return null
  }

  let markdown = ''
  const body = entry?.body
  if (typeof body === 'string') {
    markdown = body
  } else if (body?.type === 'minimark') {
    markdown = stringifyMinimark(body) || ''
  } else if (body) {
    markdown = (await stringifyMarkdown(body, {})) ?? ''
  }
  const contentHtml = await renderMarkdown(markdown)
  const isHtml = Boolean(contentHtml)
  const publishedAt = normalizeDate(entry?.createdAt)
  const title = entry?.title || entry?.stem || articleUrl

  const article: ObjectT = {
    id: articleUrl,
    type: 'Article',
    name: title,
    attributedTo: me.id,
    content: isHtml ? contentHtml : markdown,
    mediaType: isHtml ? 'text/html' : markdown ? 'text/markdown' : undefined,
    published: publishedAt,
    summary: entry?.description || undefined,
    url: articleUrl,
    to: [PUBLIC_AUDIENCE],
    source: markdown
      ? {
        content: markdown,
        mediaType: 'text/markdown',
      }
      : undefined,
  }

  return article
}

export async function buildCreateActivityFromEntry(entry: ContentEntry): Promise<CreateActivity | null> {
  const article = await buildArticleObjectFromEntry(entry)
  if (!article) {
    return null
  }

  const articleUrl = article.id
  const publishedAt = normalizeDate(article.published || entry?.createdAt || null)
  article.published = publishedAt
  if (!Array.isArray(article.to) || !article.to.length) {
    article.to = [PUBLIC_AUDIENCE]
  }

  const activity: CreateActivity = {
    '@context': CONTENT_CONTEXT,
    id: resolveActivityId(articleUrl),
    type: 'Create',
    actor: me.id,
    object: article,
    published: publishedAt,
    to: [PUBLIC_AUDIENCE],
  }

  return activity
}

type CollectOutboxOptions = {
  limit?: number | null
  offset?: number
}

export async function collectOutboxActivities(
  event: H3Event,
  options: CollectOutboxOptions = {},
): Promise<{ totalItems: number; orderedItems: CreateActivity[] }> {
  const limit = typeof options.limit === 'number' && Number.isFinite(options.limit)
    ? Math.max(0, options.limit)
    : options.limit === null
      ? null
      : OUTBOX_PAGE_SIZE
  const offset = Math.max(0, options.offset ?? 0)

  const [blogEntries, appEntries] = await Promise.all([
    queryCollection(event, 'blog').order('createdAt', 'DESC').all(),
    queryCollection(event, 'app').order('createdAt', 'DESC').all(),
  ])

  const entries = [...(blogEntries ?? []), ...(appEntries ?? [])]
  entries.sort((a, b) => {
    const aDate = a?.createdAt ? new Date(a.createdAt).getTime() : 0
    const bDate = b?.createdAt ? new Date(b.createdAt).getTime() : 0
    return bDate - aDate
  })

  const activities: CreateActivity[] = []
  for (const entry of entries) {
    const activity = await buildCreateActivityFromEntry(entry)
    if (activity) {
      activities.push(activity)
    }
  }

  const totalItems = activities.length
  const start = Math.min(offset, totalItems)
  let end = totalItems
  if (typeof limit === 'number') {
    end = Math.min(totalItems, start + limit)
  }
  const orderedItems = activities.slice(start, end)

  return { totalItems, orderedItems }
}
