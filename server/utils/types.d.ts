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
  actor: string
  published: DateLike
  to: string | string[]
  object?: ObjectT | ObjectT[]
}

interface FollowActivity extends Activity {
  object: Actor
}

interface ReplyActivity extends Activity {
  type: 'Reply'
  object: ObjectT
  inReplyTo: string
  to?: string[]
  cc?: string[]
}