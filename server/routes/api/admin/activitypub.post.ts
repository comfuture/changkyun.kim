import { readRawBody } from "h3"
import { createError } from "h3"

import {
  hideActivityPubCommentById,
  removeFollowerById,
  deleteActivityPubReactionById,
  replyActivityPubCommentById,
} from "../../../utils/activityPubAdmin"
import { unauthorizedError, verifyActivityPubAdminRequestSignature } from "../../../utils/activityPubAdminAuth"

type AdminActionBody = {
  action?: string
  id?: number | string
  reply?: string
}

function parseBody(rawBody: string | false | undefined): AdminActionBody {
  if (!rawBody) {
    return {}
  }
  try {
    return JSON.parse(rawBody) as AdminActionBody
  } catch {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid JSON body",
    })
  }
}

function toId(value: unknown): number | null {
  const id = Number.parseInt(String(value), 10)
  return Number.isFinite(id) ? id : null
}

export default defineEventHandler(async (event) => {
  const rawBody = await readRawBody(event, "utf8").catch(() => "")
  if (!(await verifyActivityPubAdminRequestSignature(event, rawBody || ""))) {
    unauthorizedError()
  }

  const body = parseBody(rawBody)
  const action = body?.action?.trim()
  const id = toId(body?.id)

  if (!action || id === null) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid request body",
    })
  }

  if (action === "comment.delete") {
    const deleted = await hideActivityPubCommentById(id)
    return {
      ok: deleted,
      action,
      id,
    }
  }

  if (action === "comment.reply") {
    const reply = typeof body?.reply === "string" ? body.reply.trim() : ""
    if (!reply) {
      throw createError({
        statusCode: 400,
        statusMessage: "Reply text is required",
      })
    }

    const result = await replyActivityPubCommentById(id, reply, event)
    return {
      ok: true,
      action,
      id,
      actorId: result.actorId,
      commentObjectId: result.commentObjectId,
    }
  }

  if (action === "reaction.delete") {
    const deleted = await deleteActivityPubReactionById(id)
    return {
      ok: deleted,
      action,
      id,
    }
  }

  if (action === "follower.unfollow") {
    const actorId = await removeFollowerById(id)
    return {
      ok: Boolean(actorId),
      action,
      id,
      actorId,
    }
  }

  throw createError({
    statusCode: 400,
    statusMessage: "Unsupported action",
  })
})
