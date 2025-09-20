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

const CONTENT_CONTEXT = 'https://www.w3.org/ns/activitystreams'

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

export async function buildCreateActivityFromEntry(entry: ContentEntry): Promise<CreateActivity | null> {
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

  const activity: CreateActivity = {
    '@context': CONTENT_CONTEXT,
    id: `${articleUrl}#create`,
    type: 'Create',
    actor: me.id,
    object: article,
    published: publishedAt,
    to: [PUBLIC_AUDIENCE],
  }

  return activity
}
