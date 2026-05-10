export type SectionKey = "followers" | "comments" | "reactions" | "search"

export type AdminAction =
  | "comment.reply"
  | "comment.react"
  | "comment.delete"
  | "reaction.delete"
  | "follower.follow"
  | "follower.unfollow"
  | "search.query"
  | "search.actor.follow"
  | "search.object.reply"
  | "search.object.react"

export type SearchItemType = "actor" | "article" | "note" | "unknown"

export type ActivityPubAdminItem = {
  id: number | string
  actorId?: string | null
  actorName?: string | null
  actorUrl?: string | null
  articlePath?: string
  contentText?: string
  createdAt?: string
  followingStatus?: string | null
  objectId?: string
  publishedAt?: string | null
  reaction?: string
  reactionType?: string
  receivedAt?: string
  status?: string
  summary?: string | null
  title?: string | null
  type?: SearchItemType
  updatedAt?: string
  url?: string | null
  actions?: string[]
}

export type AdminDashboardData = {
  followers: ActivityPubAdminItem[]
  comments: ActivityPubAdminItem[]
  reactions: ActivityPubAdminItem[]
  search: ActivityPubAdminItem[]
}

export type CliOptions = {
  baseUrl: string
  privateKey: string
  privateKeyFile: string
  keyId: string
  includeDeleted: boolean
  command: string | null
  args: string[]
  json: boolean
  text: string
  help?: boolean
}

export type SignConfig = {
  keyId: string
  privateKey: CryptoKey
}

export type DashboardState = AdminDashboardData & {
  searchQuery: string
  section: SectionKey
  selectedIndex: number
  userSelectedSection: boolean
  isLoading: boolean
  statusMessage: string
  statusIsError: boolean
}

export type SectionTabPart = {
  section: SectionKey
  text: string
}

export type DashboardUi = {
  screen: any
  list: any
  detail: any
  sectionLabel: any
  status: any
}
