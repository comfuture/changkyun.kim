import { promises as fs } from 'node:fs'
import { isAbsolute, relative, resolve } from 'node:path'

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

const CONTENT_ROOT = resolve(process.cwd(), 'content')
const FRONT_MATTER_PATTERN = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/

export type ContentEntry = {
  id?: string | null
  _id?: string | null
  path?: string | null
  _path?: string | null
  _file?: string | null
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

async function stringifyEntryBody(entry: ContentEntry): Promise<string | null> {
  if (!entry?.body) {
    return null
  }

  if (typeof entry.body === 'string') {
    const bodyString = entry.body.trim()
    return bodyString.length > 0 ? entry.body : null
  }

  try {
    const markdown = await stringifyMarkdown(entry.body, {})
    if (markdown && markdown.trim().length > 0) {
      return markdown
    }
  } catch (error) {
    const identifier = entry?._path || entry?._id || entry?.id || '[unknown entry]'
    if (error instanceof Error) {
      console.warn(`Failed to stringify markdown body for entry ${identifier}: ${error.message}`)
    } else {
      console.warn(`Failed to stringify markdown body for entry ${identifier}`)
    }
  }

  return null
}

function resolveContentFile(entry: ContentEntry): string | null {
  const filePath = entry?._file
  if (!filePath) {
    return null
  }

  const absolute = resolve(CONTENT_ROOT, filePath)
  const diff = relative(CONTENT_ROOT, absolute)
  if (!diff || diff.startsWith('..') || isAbsolute(diff)) {
    return null
  }

  if (!/\.(md|mdc|markdown)$/i.test(absolute)) {
    return null
  }

  return absolute
}

function stripFrontMatter(markdown: string): string {
  if (!markdown) {
    return ''
  }

  const matched = markdown.match(FRONT_MATTER_PATTERN)
  if (!matched) {
    return markdown
  }

  const remainder = markdown.slice(matched[0].length)
  return remainder.replace(/^\s*\r?\n/, '')
}

async function readEntryMarkdownFromFile(entry: ContentEntry): Promise<string | null> {
  const absolutePath = resolveContentFile(entry)
  if (!absolutePath) {
    return null
  }

  try {
    const raw = await fs.readFile(absolutePath, 'utf8')
    const withoutFrontMatter = stripFrontMatter(raw)
    return withoutFrontMatter.trim().length > 0 ? withoutFrontMatter : null
  } catch (error) {
    const identifier = entry?._path || entry?._id || entry?.id || '[unknown entry]'
    if (error instanceof Error) {
      console.warn(`Failed to read markdown file for entry ${identifier}: ${error.message}`)
    } else {
      console.warn(`Failed to read markdown file for entry ${identifier}`)
    }
    return null
  }
}

async function resolveEntryMarkdown(entry: ContentEntry): Promise<string> {
  const markdownFromBody = await stringifyEntryBody(entry)
  if (markdownFromBody) {
    return markdownFromBody
  }

  const markdownFromFile = await readEntryMarkdownFromFile(entry)
  if (markdownFromFile) {
    return markdownFromFile
  }

  return ''
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

  const markdown = await resolveEntryMarkdown(entry)
  const contentHtml = await renderMarkdown(markdown)
  const isHtml = contentHtml.trim().length > 0
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
