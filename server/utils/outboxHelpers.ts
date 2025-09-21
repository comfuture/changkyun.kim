import { stringifyMarkdown } from '@nuxtjs/mdc/runtime'
import { toHtml } from 'hast-util-to-html'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'

import { me, PUBLIC_AUDIENCE } from './federation'

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype, { allowDangerousHtml: true })

const siteOrigin = new URL(me.id).origin

export const CONTENT_CONTEXT = 'https://www.w3.org/ns/activitystreams'

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
  return path.startsWith('/') ? path : `/${path}`
}

function resolveArticleUrl(entry: ContentEntry): string | null {
  const path = resolveEntryPath(entry)
  if (!path) {
    return null
  }
  return `${siteOrigin}${path}`
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

export function resolveLegacyActivityIds(articleUrl: string): string[] {
  return [
    `${articleUrl}#create`,
    `${articleUrl}#activity`,
  ]
}

export async function buildArticleObjectFromEntry(entry: ContentEntry): Promise<ObjectT | null> {
  const articleUrl = resolveArticleUrl(entry)
  if (!articleUrl) {
    return null
  }

  const markdown = entry?.body ? (await stringifyMarkdown(entry.body, {})) ?? '' : ''
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
