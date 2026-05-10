import { readRawBody } from "h3"
import { createError } from "h3"

import {
  hideActivityPubCommentById,
  followActorForAdmin,
  followFollowerById,
  removeFollowerById,
  deleteActivityPubReactionById,
  reactActivityPubCommentById,
  reactRemoteActivityPubObject,
  replyRemoteActivityPubObject,
  replyActivityPubCommentById,
  searchActivityPubForAdmin,
} from "../../../utils/activityPubAdmin"
import { unauthorizedError, verifyActivityPubAdminRequestSignature } from "../../../utils/activityPubAdminAuth"

type AdminActionBody = {
  action?: string
  id?: number | string
  actorId?: string
  query?: string
  reply?: string
  reaction?: string
  targetId?: string
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

  if (action === "search.query") {
    const query = typeof body?.query === "string" ? body.query.trim() : ""
    if (!query) {
      throw createError({
        statusCode: 400,
        statusMessage: "Search query is required",
      })
    }
    return {
      ok: true,
      action,
      query,
      results: await searchActivityPubForAdmin(query, event),
    }
  }

  if (action === "search.actor.follow") {
    const actorId = typeof body?.actorId === "string" ? body.actorId.trim() : ""
    if (!actorId) {
      throw createError({
        statusCode: 400,
        statusMessage: "Actor id is required",
      })
    }
    const result = await followActorForAdmin(actorId, event)
    return {
      ok: true,
      action,
      actorId: result.actorId,
      followActivityId: result.followActivityId,
      status: result.status,
      alreadyFollowing: result.alreadyFollowing,
    }
  }

  if (action === "search.object.reply") {
    const targetId = typeof body?.targetId === "string" ? body.targetId.trim() : ""
    const reply = typeof body?.reply === "string" ? body.reply.trim() : ""
    if (!targetId || !reply) {
      throw createError({
        statusCode: 400,
        statusMessage: "Target id and reply text are required",
      })
    }
    const result = await replyRemoteActivityPubObject(targetId, reply, event)
    return {
      ok: true,
      action,
      targetId,
      actorId: result.actorId,
      objectId: result.objectId,
      replyObjectId: result.replyObjectId,
    }
  }

  if (action === "search.object.react") {
    const targetId = typeof body?.targetId === "string" ? body.targetId.trim() : ""
    const reaction = typeof body?.reaction === "string" ? body.reaction.trim() : "❤️"
    if (!targetId) {
      throw createError({
        statusCode: 400,
        statusMessage: "Target id is required",
      })
    }
    const result = await reactRemoteActivityPubObject(targetId, reaction || "❤️", event)
    return {
      ok: true,
      action,
      targetId,
      actorId: result.actorId,
      objectId: result.objectId,
      reaction: result.reaction,
      reactionType: result.reactionType,
    }
  }

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
      replyObjectId: result.replyObjectId,
    }
  }

  if (action === "comment.react") {
    const reaction = typeof body?.reaction === "string" ? body.reaction.trim() : "❤️"
    const result = await reactActivityPubCommentById(id, reaction || "❤️", event)
    return {
      ok: true,
      action,
      id,
      actorId: result.actorId,
      commentObjectId: result.commentObjectId,
      reaction: result.reaction,
      reactionType: result.reactionType,
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

  if (action === "follower.follow") {
    const result = await followFollowerById(id, event)
    return {
      ok: true,
      action,
      id,
      actorId: result.actorId,
      followActivityId: result.followActivityId,
      status: result.status,
      alreadyFollowing: result.alreadyFollowing,
    }
  }

  throw createError({
    statusCode: 400,
    statusMessage: "Unsupported action",
  })
})
