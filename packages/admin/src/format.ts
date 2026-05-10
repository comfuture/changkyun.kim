import {
  formatActionBarSectionTabs,
  formatSectionCounts,
  SECTIONS,
} from "./sections.ts"
import type { ActivityPubAdminItem, DashboardState, SectionKey } from "./types.ts"

export function formatTime(value?: string | null): string {
  if (!value) {
    return "-"
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleString("ko-KR")
}

export function trimText(value: unknown, max: number): string {
  const text = String(value || "").replace(/\s+/g, " ").trim()
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

const STATUS_ICONS: Record<string, string> = {
  accepted: "✅",
  deleted: "🗑️",
  hidden: "🙈",
  removed: "🚫",
  requested: "⏳",
  visible: "👁️",
}

const STATUS_LABELS: Record<string, string> = {
  accepted: "수락",
  deleted: "삭제",
  hidden: "숨김",
  removed: "제거",
  requested: "요청",
  visible: "표시",
}

export function getStatusIcon(status?: string | null): string {
  return status ? STATUS_ICONS[status] || "•" : "•"
}

export function formatStatusLabel(status?: string | null): string {
  if (!status) {
    return "-"
  }
  return `${getStatusIcon(status)} ${STATUS_LABELS[status] || status}`
}

function formatActorFallback(actorId?: string | null): string {
  if (!actorId) {
    return "-"
  }
  try {
    const url = new URL(actorId)
    const segment = decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() || "")
    if (segment) {
      const username = segment.startsWith("@") ? segment : `@${segment}`
      return `${username}@${url.hostname}`
    }
    return url.hostname
  } catch {
    return actorId
  }
}

export function formatActorName(item?: ActivityPubAdminItem | null): string {
  const actorId = String(item?.actorId || "")
  const actorName = String(item?.actorName || "").trim()
  if (actorName && actorName !== actorId) {
    return trimText(actorName, 32)
  }
  return trimText(formatActorFallback(actorId), 32)
}

export function formatActorDetail(item?: ActivityPubAdminItem | null): string {
  const name = formatActorName(item)
  const actorId = item?.actorId || "-"
  const actorUrl = item?.actorUrl || actorId
  return `Actor: ${name}\n주소: ${actorId}\n프로필: ${actorUrl}`
}

export function formatSearchType(item?: ActivityPubAdminItem | null): string {
  if (item?.type === "actor") {
    return "👤 액터"
  }
  if (item?.type === "article") {
    return "📝 Article"
  }
  if (item?.type === "note") {
    return "💬 Note"
  }
  return "❓ 알 수 없음"
}

export function getSelectedItem(state: DashboardState, section: SectionKey, index: number): ActivityPubAdminItem | null {
  if (index < 0) {
    return null
  }
  return state?.[section]?.[index] ?? null
}

export function formatRow(section: SectionKey, item: ActivityPubAdminItem): string {
  if (section === "followers") {
    const following = item.followingStatus ? ` · 맞팔 ${formatStatusLabel(item.followingStatus)}` : ""
    return `${getStatusIcon(item.status)} ${formatActorName(item)}${following} | ${formatTime(item.updatedAt)}`
  }
  if (section === "comments") {
    return `${getStatusIcon(item.status)} ${formatActorName(item)} | ${item.articlePath} | ${trimText(item.contentText, 60)}`
  }
  if (section === "search") {
    const title = item.title || item.contentText || item.url || item.objectId
    return `${formatSearchType(item)} | ${formatActorName(item)} | ${trimText(title, 72)}`
  }

  return `${item.reaction || "⭐"} ${formatActorName(item)} | ${item.articlePath}`
}

export function formatSelectedActions(state: DashboardState): string {
  const item = getSelectedItem(state, state.section, state.selectedIndex)
  if (!item) {
    return "선택 항목 없음"
  }
  if (state.section === "followers") {
    const followLabel = item.followingStatus ? "f: 팔로우 상태 확인" : "f: 팔로우하기"
    return `${followLabel}  u: 팔로워 제거`
  }
  if (state.section === "comments") {
    return "r: 댓글달기  d: 삭제하기"
  }
  if (state.section === "search") {
    if (item.type === "actor") {
      return "f: 팔로우하기  s: 다시 검색"
    }
    if (item.type === "article" || item.type === "note") {
      return "r: 댓글달기  l: 좋아요  e: 이모지  s: 다시 검색"
    }
    return "s: 다시 검색"
  }
  return "d: 삭제하기"
}

export function updateStatus(status: any, state: DashboardState, message?: string, isError = false): void {
  if (typeof message === "string") {
    state.statusMessage = message
    state.statusIsError = isError
  }

  const prefix = state.isLoading ? "⏳" : state.statusIsError ? "⚠️" : "ℹ️"
  const currentMessage = state.statusMessage || `${SECTIONS[state.section].label} 대기`
  status.setContent(`${prefix} ${currentMessage}
${formatActionBarSectionTabs(state, state.section)}  ↑↓/클릭 선택  s: 검색  R: 새로고침  q: 종료  |  ${formatSelectedActions(state)}`)
  status.style.bg = state.isLoading ? "yellow" : state.statusIsError ? "red" : "black"
  status.style.fg = state.isLoading ? "black" : "white"
  status.screen?.render()
}

export function updateSectionLabel(sectionLabel: any, state: DashboardState): void {
  sectionLabel.setContent(formatSectionCounts(state, state.section))
}

export function updateDetail(detail: any, section: SectionKey, item: ActivityPubAdminItem | null): void {
  if (!item) {
    detail.setContent("선택된 항목이 없습니다.")
    return
  }

  if (section === "followers") {
    detail.setContent(`
유형: 팔로우
ID: ${item.id}
${formatActorDetail(item)}
상태: ${formatStatusLabel(item.status)}
맞팔: ${item.followingStatus ? formatStatusLabel(item.followingStatus) : "없음"}
생성: ${formatTime(item.createdAt)}
수정: ${formatTime(item.updatedAt)}
    `.trim())
    return
  }

  if (section === "comments") {
    detail.setContent(`
유형: 댓글
ID: ${item.id}
${formatActorDetail(item)}
경로: ${item.articlePath}
상태: ${formatStatusLabel(item.status)}
작성시각: ${formatTime(item.publishedAt)}
내용: ${item.contentText}
원문객체: ${item.objectId}
    `.trim())
    return
  }

  if (section === "search") {
    detail.setContent(`
유형: ${formatSearchType(item)}
ID: ${item.objectId || item.id}
${formatActorDetail(item)}
URL: ${item.url || "-"}
제목: ${item.title || "-"}
요약: ${item.summary || "-"}
작성시각: ${formatTime(item.publishedAt)}
내용: ${item.contentText || "-"}
가능한 동작: ${(item.actions || []).join(", ") || "없음"}
    `.trim())
    return
  }

  detail.setContent(`
유형: 리액션
ID: ${item.id}
${formatActorDetail(item)}
경로: ${item.articlePath}
리액션: ${item.reaction} (${item.reactionType})
작성시각: ${formatTime(item.publishedAt)}
원문객체: ${item.objectId}
  `.trim())
}
