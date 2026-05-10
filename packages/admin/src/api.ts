import { createSignedHeaders } from "./signing.ts"
import type { AdminAction, AdminDashboardData, SignConfig } from "./types.ts"

export function normalizeInputUrl(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  const text = await response.text().catch(() => "")
  if (!text) {
    return fallback
  }
  try {
    const payload = JSON.parse(text)
    return payload?.statusMessage || payload?.message || payload?.error || text.slice(0, 160)
  } catch {
    return text.replace(/\s+/g, " ").trim().slice(0, 160)
  }
}

export async function requestAdminData(
  baseUrl: string,
  signConfig: SignConfig,
  includeDeleted: boolean,
): Promise<AdminDashboardData> {
  const endpoint = `${normalizeInputUrl(baseUrl)}/api/admin/activitypub?includeDeleted=${includeDeleted ? "1" : "0"}`
  const signing = await createSignedHeaders(endpoint, "GET", null, signConfig.keyId, signConfig.privateKey)
  const response = await fetch(endpoint, {
    headers: {
      Accept: "application/json",
      Date: signing.date,
      Signature: signing.signature,
      ...(signing.digest ? { Digest: signing.digest } : {}),
    },
  })

  if (!response.ok) {
    const message = await readErrorMessage(response, "Failed to load admin data")
    throw new Error(`HTTP ${response.status} ${response.statusText}: ${message}`)
  }

  return response.json() as Promise<AdminDashboardData>
}

export async function requestAdminAction(
  baseUrl: string,
  signConfig: SignConfig,
  action: AdminAction,
  id: number | string | null = null,
  payload: Record<string, unknown> = {},
): Promise<any> {
  const endpoint = `${normalizeInputUrl(baseUrl)}/api/admin/activitypub`
  const requestBody = id == null ? { action, ...payload } : { action, id, ...payload }
  const body = JSON.stringify(requestBody)
  const signing = await createSignedHeaders(endpoint, "POST", requestBody, signConfig.keyId, signConfig.privateKey)
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Date: signing.date,
      Signature: signing.signature,
      Digest: signing.digest || "",
      "Content-Type": "application/json",
    },
    body,
  })

  if (!response.ok) {
    const message = await readErrorMessage(response, "Failed to run admin action")
    throw new Error(`HTTP ${response.status} ${response.statusText}: ${message}`)
  }
  return response.json().catch(() => ({}))
}
