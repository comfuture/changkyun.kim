import type { AdminDashboardData, SectionKey, SectionTabPart } from "./types.ts"

export const SECTIONS: Record<SectionKey, { key: SectionKey; label: string }> = {
  followers: { key: "followers", label: "팔로우" },
  comments: { key: "comments", label: "댓글" },
  reactions: { key: "reactions", label: "리액션" },
  search: { key: "search", label: "검색" },
}

export const SECTION_ORDER: SectionKey[] = ["followers", "comments", "reactions", "search"]
export const SECTION_TAB_GAP = "   "
export const ACTION_BAR_TAB_GAP = " "

export function getSectionCount(data: Partial<AdminDashboardData>, section: SectionKey): number {
  return Array.isArray(data?.[section]) ? data[section].length : 0
}

export function getSectionTabParts(
  data: Partial<AdminDashboardData>,
  currentSection: SectionKey,
  { counts = false } = {},
): SectionTabPart[] {
  return SECTION_ORDER.map((section, index) => {
    const marker = section === currentSection ? ">" : " "
    const label = `[${index + 1}]${SECTIONS[section].label}`
    return {
      section,
      text: counts ? `${marker} ${label}: ${getSectionCount(data, section)}` : label,
    }
  })
}

export function formatSectionCounts(data: Partial<AdminDashboardData>, currentSection: SectionKey): string {
  return getSectionTabParts(data, currentSection, { counts: true })
    .map((part) => part.text)
    .join(SECTION_TAB_GAP)
}

export function formatActionBarSectionTabs(data: Partial<AdminDashboardData>, currentSection: SectionKey): string {
  return getSectionTabParts(data, currentSection)
    .map((part) => part.text)
    .join(ACTION_BAR_TAB_GAP)
}

export function normalizeSection(value: string | undefined): SectionKey | null {
  if (!value || value === "all") {
    return null
  }
  const section = String(value).toLowerCase()
  if (["follower", "followers", "follow"].includes(section)) {
    return "followers"
  }
  if (["comment", "comments"].includes(section)) {
    return "comments"
  }
  if (["reaction", "reactions", "like", "likes"].includes(section)) {
    return "reactions"
  }
  throw new Error(`Unknown section: ${value}`)
}
