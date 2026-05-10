import process from "node:process"

import { requestAdminAction, requestAdminData } from "../api.ts"
import {
  formatActorName,
  formatRow,
  formatSearchType,
  getSelectedItem,
  updateDetail,
  updateSectionLabel,
  updateStatus,
} from "../format.ts"
import {
  ACTION_BAR_TAB_GAP,
  getSectionCount,
  getSectionTabParts,
  SECTION_ORDER,
  SECTION_TAB_GAP,
  SECTIONS,
} from "../sections.ts"
import type { CliOptions, DashboardState, DashboardUi, SectionKey, SignConfig } from "../types.ts"
import { blessed } from "./blessed.ts"
import { getClickedSectionFromTabs, getListIndexAtMouse } from "./clicks.ts"
import { openLinePrompt, openTextPrompt } from "./prompts.ts"

function createDashboardUi(): DashboardUi {
  const screen = blessed.screen({
    smartCSR: true,
    fullUnicode: true,
    title: "ActivityPub Admin",
    cursor: { artificial: true },
  })

  screen.key(["C-c", "q"], () => process.exit(0))

  const header = blessed.box({
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    style: { fg: "white", bg: "blue" },
    align: "center",
    content: "ActivityPub Admin Dashboard",
  })

  const sectionLabel = blessed.box({
    top: 1,
    left: 1,
    right: 1,
    height: 1,
    mouse: true,
    content: "",
  })

  const list = blessed.list({
    top: 3,
    left: 1,
    width: "68%",
    bottom: 2,
    border: "line",
    keys: true,
    mouse: true,
    vi: true,
    label: "아이템",
    items: [],
    scrollbar: {
      ch: " ",
      track: { bg: "yellow" },
      style: { inverse: true },
    },
    style: {
      selected: {
        bg: "blue",
        fg: "white",
      },
    },
  })

  const detail = blessed.box({
    top: 3,
    left: "68%",
    right: 1,
    bottom: 2,
    border: "line",
    label: "상세",
    scrollable: true,
    alwaysScroll: true,
    mouse: true,
    content: "",
    keys: true,
    vi: true,
  })

  const status = blessed.box({
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    mouse: true,
    style: { fg: "white", bg: "black" },
  })

  screen.append(header)
  screen.append(sectionLabel)
  screen.append(list)
  screen.append(detail)
  screen.append(status)

  screen.render()

  return { screen, list, detail, sectionLabel, status }
}

function createInitialState(): DashboardState {
  return {
    followers: [],
    comments: [],
    reactions: [],
    search: [],
    searchQuery: "",
    section: "followers",
    selectedIndex: 0,
    userSelectedSection: false,
    isLoading: false,
    statusMessage: "",
    statusIsError: false,
  }
}

export async function runDashboard(options: CliOptions, signConfig: SignConfig): Promise<void> {
  const ui = createDashboardUi()
  const state = createInitialState()

  updateSectionLabel(ui.sectionLabel, state)

  let isApplyingSelection = false

  function replaceListItems(items: string[]): void {
    if (typeof ui.list.clearItems === "function") {
      ui.list.clearItems()
    }
    if (typeof ui.list.setScroll === "function") {
      ui.list.setScroll(0)
    }
    ui.list.childBase = 0
    ui.list.childOffset = 0
    ui.list.setItems(items)
  }

  function bindListItemMouseSelection(): void {
    ui.list.items.forEach((item: any, index: number) => {
      if (item._adminSelectionClickBound) {
        return
      }
      item._adminSelectionClickBound = true
      item.on("click", () => {
        applySelection(index, { syncList: true })
      })
    })
  }

  function renderCurrentSection(message?: string): void {
    const listData = state[state.section]
    if (listData.length === 0) {
      state.selectedIndex = -1
      replaceListItems(["항목이 없습니다."])
    } else {
      replaceListItems(listData.map((item) => formatRow(state.section, item)))
      bindListItemMouseSelection()
      state.selectedIndex = Math.max(0, Math.min(state.selectedIndex, listData.length - 1))
      ui.list.select(state.selectedIndex)
    }

    updateDetail(ui.detail, state.section, getSelectedItem(state, state.section, state.selectedIndex))
    updateSectionLabel(ui.sectionLabel, state)
    updateStatus(ui.status, state, message || `${SECTIONS[state.section].label} ${listData.length}개`, false)
    ui.screen.render()
  }

  async function refresh(): Promise<void> {
    try {
      state.isLoading = true
      updateStatus(ui.status, state, `데이터 새로고침 중... (${options.baseUrl})`, false)
      ui.screen.render()
      const payload = await requestAdminData(options.baseUrl, signConfig, options.includeDeleted)
      state.followers = payload.followers || []
      state.comments = payload.comments || []
      state.reactions = payload.reactions || []

      if (!state.userSelectedSection && getSectionCount(state, state.section) === 0) {
        const firstNonEmptySection = SECTION_ORDER.find((section) => getSectionCount(state, section) > 0)
        if (firstNonEmptySection) {
          state.section = firstNonEmptySection
          state.selectedIndex = 0
        }
      }

      state.isLoading = false
      renderCurrentSection()
    } catch (error: any) {
      state.isLoading = false
      updateStatus(ui.status, state, String(error?.message || error), true)
      ui.screen.render()
    }
  }

  async function promptSearchQuery(): Promise<void> {
    const query = await openLinePrompt(ui.screen, "검색어", "")
    if (!query) {
      updateStatus(ui.status, state, "검색이 취소되었습니다.")
      return
    }

    await runSearch(query)
  }

  async function runSearch(query: string): Promise<void> {
    state.section = "search"
    state.userSelectedSection = true
    state.searchQuery = query
    state.search = []
    state.selectedIndex = 0
    state.isLoading = true
    renderCurrentSection(`검색 중... ${query}`)
    try {
      const payload = await requestAdminAction(options.baseUrl, signConfig, "search.query", null, { query })
      state.search = Array.isArray(payload?.results) ? payload.results : []
      state.selectedIndex = state.search.length > 0 ? 0 : -1
      state.isLoading = false
      renderCurrentSection(`검색 결과 ${state.search.length}개: ${query}`)
    } catch (error: any) {
      state.isLoading = false
      updateStatus(ui.status, state, String(error?.message || error), true)
      ui.screen.render()
    }
  }

  function activateSearchSection(): void {
    state.section = "search"
    state.search = []
    state.searchQuery = ""
    state.selectedIndex = -1
    state.userSelectedSection = true
    renderCurrentSection("검색어를 입력하세요.")
    void promptSearchQuery()
  }

  function switchSection(section: SectionKey): void {
    if (state.section === section) {
      return
    }
    state.section = section
    state.selectedIndex = 0
    state.userSelectedSection = true
    renderCurrentSection()
  }

  function selectSection(section: SectionKey): void {
    if (section === "search") {
      activateSearchSection()
      return
    }
    switchSection(section)
  }

  function applySelection(index: number, { syncList = false } = {}): void {
    if (isApplyingSelection) {
      return
    }

    isApplyingSelection = true
    try {
      const listData = state[state.section]
      if (listData.length === 0) {
        state.selectedIndex = -1
        updateDetail(ui.detail, state.section, null)
        updateStatus(ui.status, state)
        ui.screen.render()
        return
      }

      state.selectedIndex = Math.max(0, Math.min(index, listData.length - 1))
      if (syncList && ui.list.selected !== state.selectedIndex) {
        ui.list.select(state.selectedIndex)
      }
      updateDetail(ui.detail, state.section, getSelectedItem(state, state.section, state.selectedIndex))
      updateStatus(ui.status, state)
      ui.screen.render()
    } finally {
      isApplyingSelection = false
    }
  }

  async function handleAction(action: "reply" | "delete" | "follow" | "unfollow" | "like" | "react"): Promise<void> {
    const item = getSelectedItem(state, state.section, state.selectedIndex)
    if (!item) {
      updateStatus(ui.status, state, "선택된 항목이 없습니다.", true)
      return
    }

    if (action === "reply") {
      if (state.section === "search") {
        if (item.type !== "article" && item.type !== "note") {
          updateStatus(ui.status, state, "Article/Note 검색 결과에만 댓글을 작성할 수 있습니다.", true)
          return
        }
        const value = await openTextPrompt(ui.screen, "댓글")
        if (!value) {
          updateStatus(ui.status, state, "댓글 작성이 취소되었습니다.")
          return
        }
        try {
          await requestAdminAction(options.baseUrl, signConfig, "search.object.reply", null, {
            targetId: item.objectId,
            reply: value,
          })
          updateStatus(ui.status, state, `${formatSearchType(item)} 댓글 전송 완료`)
        } catch (error: any) {
          updateStatus(ui.status, state, String(error?.message || error), true)
        }
        return
      }

      if (state.section !== "comments") {
        updateStatus(ui.status, state, "댓글 섹션에서만 대댓글을 작성할 수 있습니다.", true)
        return
      }
      const value = await openTextPrompt(ui.screen, "대댓글")
      if (!value) {
        updateStatus(ui.status, state, "답글이 취소되었습니다.")
        return
      }
      try {
        await requestAdminAction(options.baseUrl, signConfig, "comment.reply", item.id, { reply: value })
        updateStatus(ui.status, state, `댓글 ID:${item.id} 대댓글 전송 완료`)
        await refresh()
      } catch (error: any) {
        updateStatus(ui.status, state, String(error?.message || error), true)
      }
      return
    }

    if (action === "delete") {
      if (state.section === "followers") {
        updateStatus(ui.status, state, "팔로워는 언팔로우(u)로 처리하세요.", true)
        return
      }
      const actionName = state.section === "comments" ? "comment.delete" : "reaction.delete"
      try {
        await requestAdminAction(options.baseUrl, signConfig, actionName, item.id)
        updateStatus(ui.status, state, `항목 ID:${item.id} 삭제 처리`)
        await refresh()
      } catch (error: any) {
        updateStatus(ui.status, state, String(error?.message || error), true)
      }
      return
    }

    if (action === "follow") {
      if (state.section === "search") {
        if (item.type !== "actor" || !item.actorId) {
          updateStatus(ui.status, state, "액터 검색 결과만 팔로우할 수 있습니다.", true)
          return
        }
        try {
          const result = await requestAdminAction(options.baseUrl, signConfig, "search.actor.follow", null, {
            actorId: item.actorId,
          })
          const suffix = result?.alreadyFollowing ? "이미 팔로우 중" : "팔로우 요청 완료"
          updateStatus(ui.status, state, `${formatActorName(item)} ${suffix}`)
        } catch (error: any) {
          updateStatus(ui.status, state, String(error?.message || error), true)
        }
        return
      }

      if (state.section !== "followers") {
        updateStatus(ui.status, state, "팔로우 섹션에서만 팔로우하세요.", true)
        return
      }
      try {
        const result = await requestAdminAction(options.baseUrl, signConfig, "follower.follow", item.id)
        const suffix = result?.alreadyFollowing ? "이미 팔로우 중" : "팔로우 요청 완료"
        updateStatus(ui.status, state, `팔로워 ID:${item.id} ${suffix}`)
        await refresh()
      } catch (error: any) {
        updateStatus(ui.status, state, String(error?.message || error), true)
      }
      return
    }

    if (action === "unfollow") {
      if (state.section !== "followers") {
        updateStatus(ui.status, state, "팔로우 섹션에서만 언팔로우하세요.", true)
        return
      }
      try {
        await requestAdminAction(options.baseUrl, signConfig, "follower.unfollow", item.id)
        updateStatus(ui.status, state, `팔로워 ID:${item.id} 언팔로우 처리`)
        await refresh()
      } catch (error: any) {
        updateStatus(ui.status, state, String(error?.message || error), true)
      }
    }

    if (action === "like") {
      if (state.section !== "search" || (item.type !== "article" && item.type !== "note")) {
        updateStatus(ui.status, state, "Article/Note 검색 결과만 좋아요할 수 있습니다.", true)
        return
      }
      try {
        await requestAdminAction(options.baseUrl, signConfig, "search.object.react", null, {
          targetId: item.objectId,
          reaction: "❤️",
        })
        updateStatus(ui.status, state, `${formatSearchType(item)} 좋아요 전송 완료`)
      } catch (error: any) {
        updateStatus(ui.status, state, String(error?.message || error), true)
      }
      return
    }

    if (action === "react") {
      if (state.section !== "search" || (item.type !== "article" && item.type !== "note")) {
        updateStatus(ui.status, state, "Article/Note 검색 결과만 이모지 반응할 수 있습니다.", true)
        return
      }
      const reaction = await openLinePrompt(ui.screen, "이모지", "❤️")
      if (!reaction) {
        updateStatus(ui.status, state, "이모지 반응이 취소되었습니다.")
        return
      }
      try {
        await requestAdminAction(options.baseUrl, signConfig, "search.object.react", null, {
          targetId: item.objectId,
          reaction,
        })
        updateStatus(ui.status, state, `${formatSearchType(item)} ${reaction} 반응 전송 완료`)
      } catch (error: any) {
        updateStatus(ui.status, state, String(error?.message || error), true)
      }
    }
  }

  ui.list.on("select item", (_: unknown, index: number) => {
    applySelection(index)
  })

  ui.list.on("select", (_: unknown, index: number) => {
    applySelection(index)
  })

  ui.list.on("click", (data: any) => {
    const index = getListIndexAtMouse(ui.list, data)
    if (index != null) {
      applySelection(index, { syncList: true })
    }
  })

  ui.sectionLabel.on("click", (data: any) => {
    const section = getClickedSectionFromTabs(
      ui.sectionLabel,
      data,
      getSectionTabParts(state, state.section, { counts: true }),
      SECTION_TAB_GAP,
    )
    if (section) {
      selectSection(section)
    }
  })

  ui.status.on("click", (data: any) => {
    const section = getClickedSectionFromTabs(
      ui.status,
      data,
      getSectionTabParts(state, state.section),
      ACTION_BAR_TAB_GAP,
      1,
    )
    if (section) {
      selectSection(section)
    }
  })

  ui.screen.key(["1"], () => selectSection(SECTION_ORDER[0]))
  ui.screen.key(["2"], () => selectSection(SECTION_ORDER[1]))
  ui.screen.key(["3"], () => selectSection(SECTION_ORDER[2]))
  ui.screen.key(["4", "s", "S"], () => selectSection("search"))
  ui.screen.key(["r"], () => {
    void handleAction("reply")
  })
  ui.screen.key(["d", "D", "x", "X"], () => {
    void handleAction("delete")
  })
  ui.screen.key(["f", "F"], () => {
    void handleAction("follow")
  })
  ui.screen.key(["u", "U"], () => {
    void handleAction("unfollow")
  })
  ui.screen.key(["l", "L"], () => {
    void handleAction("like")
  })
  ui.screen.key(["e", "E"], () => {
    void handleAction("react")
  })
  ui.screen.key(["tab", "space", "R", "C-r"], () => {
    void refresh()
  })

  ui.list.focus()
  await refresh()
}
