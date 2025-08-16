type ActivityType =
  | 'Accept'
  | 'Add'
  | 'Announce'
  | 'Arrive'
  | 'Block'
  | 'Create'
  | 'Delete'
  | 'Dislike'
  | 'Flag'
  | 'Follow'
  | 'Ignore'
  | 'Invite'
  | 'Join'
  | 'Leave'
  | 'Like'
  | 'Move'
  | 'Offer'
  | 'Reject'
  | 'Remove'
// ...

type ObjectType =
  | 'Article'
  | 'Audio'
  | 'Document'
  | 'Event'
  | 'Image'
  | 'Note'
  | 'Page'
  | 'Place'
  | 'Profile'
  | 'Video'
  | 'Person'
// ...

type DateLike = string | Date

interface DictLike {
  get(key: string): string | null
}

interface PublicKey {
  id: string
  owner: string
  publicKeyPem: string
}

interface Actor {
  id: string
  publicKey?: PublicKey
}

interface ObjectT {
  id: string
  type: ObjectType
  name: string
  attributedTo?: string
  content?: string
  published?: DateLike
  to?: string[]
}

interface Note extends ObjectT {
  type: 'Note'
}

interface Activity {
  '@context': string | string[]
  id: string
  type: ActivityType
  actor: string | Actor
  // published: DateLike
  // to: string | string[]
  // object?: ObjectT | ObjectT[]
}

interface AcceptActivity extends Activity {
  type: 'Accept'
  object: ObjectT | string
}

interface FollowActivity extends Activity {
  type: 'Follow'
  actor: string
  object: string
}

interface ReplyActivity extends Activity {
  type: 'Reply'
  object: ObjectT
  inReplyTo: string
  to?: string[]
  cc?: string[]
}