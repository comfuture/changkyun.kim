import { stringifyMarkdown } from "@nuxtjs/mdc/runtime"
import { toHtml } from "hast-util-to-html"
import remarkGfm from "remark-gfm"
import remarkParse from "remark-parse"
import remarkRehype from "remark-rehype"
import { unified } from "unified"
import { me, PUBLIC_AUDIENCE, setJsonLdHeader } from "../../utils/federation"

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype, { allowDangerousHtml: true })

const siteOrigin = new URL(me.id).origin

async function renderMarkdown(markdown: string): Promise<string> {
  if (!markdown) {
    return ''
  }
  const tree = processor.parse(markdown)
  const result = await processor.run(tree)
  return toHtml(result, { allowDangerousHtml: true })
}

function resolveArticleUrl(path?: string | null): string | null {
  if (!path) {
    return null
  }
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${siteOrigin}${normalized}`
}

export default defineEventHandler(async (event) => {
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
    const articleUrl = resolveArticleUrl(entry?.path || entry?.id)
    if (!articleUrl) {
      continue
    }

    const markdown = entry?.body ? (await stringifyMarkdown(entry.body, {})) ?? '' : ''
    const contentHtml = await renderMarkdown(markdown)
    const isHtml = Boolean(contentHtml)
    const publishedAt = entry?.createdAt ? new Date(entry.createdAt).toISOString() : new Date().toISOString()
    const title = entry?.title || entry?.stem || articleUrl

    const article: ObjectT = {
      id: articleUrl,
      type: 'Article',
      name: title,
      attributedTo: me.id,
      content: isHtml ? contentHtml : markdown,
      mediaType: isHtml ? 'text/html' : markdown ? 'text/markdown' : undefined,
      published: publishedAt,
      summary: entry?.description,
      url: articleUrl,
      to: [PUBLIC_AUDIENCE],
      source: markdown
        ? {
          content: markdown,
          mediaType: 'text/markdown',
        }
        : undefined,
    }

    const createActivity: CreateActivity = {
      '@context': 'https://www.w3.org/ns/activitystreams',
      id: `${articleUrl}#create`,
      type: 'Create',
      actor: me.id,
      object: article,
      published: publishedAt,
      to: [PUBLIC_AUDIENCE],
    }

    activities.push(createActivity)
  }

  setJsonLdHeader(event)

  return {
    '@context': 'https://www.w3.org/ns/activitystreams',
    id: me.outbox,
    type: 'OrderedCollection',
    totalItems: activities.length,
    orderedItems: activities,
  }
})
