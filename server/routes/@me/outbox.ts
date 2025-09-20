import { me, setJsonLdHeader } from "../../utils/federation"
import { buildCreateActivityFromEntry } from "../../utils/outboxHelpers"

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
    const activity = await buildCreateActivityFromEntry(entry)
    if (activity) {
      activities.push(activity)
    }
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
