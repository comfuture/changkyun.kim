import { me, setJsonLdHeader } from "../../utils/federation"
import { collectOutboxActivities, OUTBOX_PAGE_SIZE } from "../../utils/outboxHelpers"

export default defineEventHandler(async (event) => {
  const { totalItems, orderedItems } = await collectOutboxActivities(event, {
    limit: OUTBOX_PAGE_SIZE,
    offset: 0,
  })

  setJsonLdHeader(event)

  return {
    '@context': 'https://www.w3.org/ns/activitystreams',
    id: me.outbox,
    type: 'OrderedCollection',
    totalItems,
    orderedItems,
  }
})
