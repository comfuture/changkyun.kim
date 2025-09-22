import { sendActivity } from "../../utils/federation"

const DEFAULT_INITIAL_DELAY_MS = 1500
const BETWEEN_DELIVERY_DELAY_MS = 800
const RETRY_DELAY_MS = 3000
const MAX_RETRIES = 3

type DeliverBacklogPayload = {
  activities?: CreateActivity[]
  target?: string | string[]
  initialDelay?: number
}

type DeliveryFailure = {
  activityId: string | null
  actor: string
  message: string
  attempts: number
}

function isCreateActivity(value: any): value is CreateActivity {
  return value && typeof value === 'object' && value.type === 'Create'
}

function normalizeTarget(target: string | string[] | undefined): string | null {
  if (!target) {
    return null
  }
  if (Array.isArray(target)) {
    for (const entry of target) {
      if (typeof entry === 'string' && entry) {
        return entry
      }
    }
    return null
  }
  return typeof target === 'string' && target ? target : null
}

function resolveDelay(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback
  }
  return Math.max(0, Math.trunc(value))
}

function wait(ms: number): Promise<void> {
  if (!ms) {
    return Promise.resolve()
  }
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export default defineTask({
  meta: {
    name: 'ap:deliverBacklog',
    description: 'Deliver Create activities backlog to a newly-accepted follower',
  },
  async run(event) {
    const { activities, target, initialDelay } = event.payload as DeliverBacklogPayload

    const normalizedTarget = normalizeTarget(target)
    const backlog = Array.isArray(activities) ? activities.filter(isCreateActivity) : []

    if (!normalizedTarget || backlog.length === 0) {
      return { result: false, reason: 'invalid-payload' }
    }

    const initialWait = resolveDelay(initialDelay, DEFAULT_INITIAL_DELAY_MS)
    if (initialWait > 0) {
      await wait(initialWait)
    }

    let delivered = 0
    const failures: DeliveryFailure[] = []

    for (let index = 0; index < backlog.length; index += 1) {
      const activity = backlog[index]
      const activityId = typeof activity?.id === 'string' ? activity.id : null
      let attempt = 0
      let success = false
      let lastError: Error | null = null

      while (attempt < MAX_RETRIES && !success) {
        attempt += 1
        try {
          await sendActivity(activity, normalizedTarget)
          success = true
          delivered += 1
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error))
          if (attempt < MAX_RETRIES) {
            await wait(RETRY_DELAY_MS)
          }
        }
      }

      if (!success) {
        failures.push({
          activityId,
          actor: normalizedTarget,
          message: lastError?.message ?? 'Unknown delivery failure',
          attempts: attempt,
        })
      }

      if (index < backlog.length - 1 && BETWEEN_DELIVERY_DELAY_MS > 0) {
        await wait(BETWEEN_DELIVERY_DELAY_MS)
      }
    }

    if (failures.length) {
      console.warn('Backlog delivery completed with failures', failures)
    }

    return {
      result: true,
      delivered,
      failed: failures,
      total: backlog.length,
    }
  },
})
