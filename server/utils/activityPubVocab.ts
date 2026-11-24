// JSON-LD contexts emitted for each document type.
//
// These are the exact `@context` values the previous Fedify-based
// implementation produced (recorded in tests/fixtures/golden), kept so that
// served and delivered documents stay byte-for-byte compatible apart from the
// dropped Linked Data signature.

import { expandPublicCollection, type JsonObject } from "@changkyun/activitypub"

/** `Person` (the local actor). */
export const ACTOR_CONTEXT = [
  "https://www.w3.org/ns/activitystreams",
  "https://w3id.org/security/v1",
  "https://w3id.org/security/data-integrity/v1",
  "https://www.w3.org/ns/did/v1",
  "https://w3id.org/security/multikey/v1",
  "https://gotosocial.org/ns",
  {
    "alsoKnownAs": {
      "@id": "as:alsoKnownAs",
      "@type": "@id"
    },
    "manuallyApprovesFollowers": "as:manuallyApprovesFollowers",
    "movedTo": {
      "@id": "as:movedTo",
      "@type": "@id"
    },
    "toot": "http://joinmastodon.org/ns#",
    "Emoji": "toot:Emoji",
    "featured": {
      "@id": "toot:featured",
      "@type": "@id"
    },
    "featuredTags": {
      "@id": "toot:featuredTags",
      "@type": "@id"
    },
    "discoverable": "toot:discoverable",
    "suspended": "toot:suspended",
    "memorial": "toot:memorial",
    "indexable": "toot:indexable",
    "schema": "http://schema.org#",
    "PropertyValue": "schema:PropertyValue",
    "value": "schema:value",
    "misskey": "https://misskey-hub.net/ns#",
    "_misskey_followedMessage": "misskey:_misskey_followedMessage",
    "isCat": "misskey:isCat"
  }
] as const

/** `OrderedCollection` / `OrderedCollectionPage`. */
export const COLLECTION_CONTEXT = [
  "https://www.w3.org/ns/activitystreams",
  "https://w3id.org/security/data-integrity/v1",
  "https://gotosocial.org/ns",
  {
    "toot": "http://joinmastodon.org/ns#",
    "misskey": "https://misskey-hub.net/ns#",
    "fedibird": "http://fedibird.com/ns#",
    "ChatMessage": "http://litepub.social/ns#ChatMessage",
    "sensitive": "as:sensitive",
    "votersCount": "toot:votersCount",
    "Emoji": "toot:Emoji",
    "Hashtag": "as:Hashtag",
    "quote": {
      "@id": "https://w3id.org/fep/044f#quote",
      "@type": "@id"
    },
    "quoteUrl": "as:quoteUrl",
    "_misskey_quote": "misskey:_misskey_quote",
    "quoteUri": "fedibird:quoteUri",
    "QuoteAuthorization": "https://w3id.org/fep/044f#QuoteAuthorization",
    "QuoteRequest": "https://w3id.org/fep/044f#QuoteRequest",
    "quoteAuthorization": {
      "@id": "https://w3id.org/fep/044f#quoteAuthorization",
      "@type": "@id"
    },
    "emojiReactions": {
      "@id": "fedibird:emojiReactions",
      "@type": "@id"
    }
  }
] as const

/** `Article` and `Note`. */
export const OBJECT_CONTEXT = [
  "https://www.w3.org/ns/activitystreams",
  "https://w3id.org/security/data-integrity/v1",
  "https://gotosocial.org/ns",
  {
    "toot": "http://joinmastodon.org/ns#",
    "misskey": "https://misskey-hub.net/ns#",
    "fedibird": "http://fedibird.com/ns#",
    "sensitive": "as:sensitive",
    "Emoji": "toot:Emoji",
    "Hashtag": "as:Hashtag",
    "quote": {
      "@id": "https://w3id.org/fep/044f#quote",
      "@type": "@id"
    },
    "quoteUrl": "as:quoteUrl",
    "_misskey_quote": "misskey:_misskey_quote",
    "quoteUri": "fedibird:quoteUri",
    "QuoteAuthorization": "https://w3id.org/fep/044f#QuoteAuthorization",
    "quoteAuthorization": {
      "@id": "https://w3id.org/fep/044f#quoteAuthorization",
      "@type": "@id"
    },
    "emojiReactions": {
      "@id": "fedibird:emojiReactions",
      "@type": "@id"
    }
  }
] as const

/** `Create`. */
export const CREATE_CONTEXT = [
  "https://w3id.org/identity/v1",
  "https://www.w3.org/ns/activitystreams",
  "https://w3id.org/security/data-integrity/v1",
  "https://gotosocial.org/ns",
  {
    "toot": "http://joinmastodon.org/ns#",
    "misskey": "https://misskey-hub.net/ns#",
    "fedibird": "http://fedibird.com/ns#",
    "sensitive": "as:sensitive",
    "votersCount": {
      "@id": "toot:votersCount",
      "@type": "http://www.w3.org/2001/XMLSchema#nonNegativeInteger"
    },
    "Emoji": "toot:Emoji",
    "Hashtag": "as:Hashtag",
    "ChatMessage": "http://litepub.social/ns#ChatMessage",
    "quote": {
      "@id": "https://w3id.org/fep/044f#quote",
      "@type": "@id"
    },
    "quoteUrl": "as:quoteUrl",
    "_misskey_quote": "misskey:_misskey_quote",
    "quoteUri": "fedibird:quoteUri",
    "QuoteAuthorization": "https://w3id.org/fep/044f#QuoteAuthorization",
    "QuoteRequest": "https://w3id.org/fep/044f#QuoteRequest",
    "quoteAuthorization": {
      "@id": "https://w3id.org/fep/044f#quoteAuthorization",
      "@type": "@id"
    },
    "emojiReactions": {
      "@id": "fedibird:emojiReactions",
      "@type": "@id"
    }
  }
] as const

/** `Follow`. */
export const FOLLOW_CONTEXT = [
  "https://w3id.org/identity/v1",
  "https://www.w3.org/ns/activitystreams",
  "https://w3id.org/security/v1",
  "https://w3id.org/security/data-integrity/v1",
  "https://www.w3.org/ns/did/v1",
  "https://w3id.org/security/multikey/v1",
  "https://gotosocial.org/ns"
] as const

/** `Accept`. */
export const ACCEPT_CONTEXT = [
  "https://w3id.org/identity/v1",
  "https://www.w3.org/ns/activitystreams",
  "https://w3id.org/security/data-integrity/v1",
  "https://gotosocial.org/ns"
] as const

/** `Update` (of the local `Person`). */
export const UPDATE_CONTEXT = [
  "https://w3id.org/identity/v1",
  "https://www.w3.org/ns/activitystreams",
  "https://w3id.org/security/v1",
  "https://w3id.org/security/data-integrity/v1",
  "https://www.w3.org/ns/did/v1",
  "https://w3id.org/security/multikey/v1",
  "https://gotosocial.org/ns",
  {
    "alsoKnownAs": {
      "@id": "as:alsoKnownAs",
      "@type": "@id"
    },
    "manuallyApprovesFollowers": "as:manuallyApprovesFollowers",
    "sensitive": "as:sensitive",
    "movedTo": {
      "@id": "as:movedTo",
      "@type": "@id"
    },
    "quoteUrl": "as:quoteUrl",
    "toot": "http://joinmastodon.org/ns#",
    "featured": {
      "@id": "toot:featured",
      "@type": "@id"
    },
    "featuredTags": {
      "@id": "toot:featuredTags",
      "@type": "@id"
    },
    "discoverable": "toot:discoverable",
    "suspended": "toot:suspended",
    "memorial": "toot:memorial",
    "indexable": "toot:indexable",
    "votersCount": {
      "@id": "toot:votersCount",
      "@type": "http://www.w3.org/2001/XMLSchema#nonNegativeInteger"
    },
    "Emoji": "toot:Emoji",
    "Hashtag": "as:Hashtag",
    "schema": "http://schema.org#",
    "PropertyValue": "schema:PropertyValue",
    "value": "schema:value",
    "ChatMessage": "http://litepub.social/ns#ChatMessage",
    "quote": {
      "@id": "https://w3id.org/fep/044f#quote",
      "@type": "@id"
    },
    "fedibird": "http://fedibird.com/ns#",
    "quoteUri": "fedibird:quoteUri",
    "QuoteAuthorization": "https://w3id.org/fep/044f#QuoteAuthorization",
    "QuoteRequest": "https://w3id.org/fep/044f#QuoteRequest",
    "quoteAuthorization": {
      "@id": "https://w3id.org/fep/044f#quoteAuthorization",
      "@type": "@id"
    },
    "misskey": "https://misskey-hub.net/ns#",
    "_misskey_quote": "misskey:_misskey_quote",
    "_misskey_followedMessage": "misskey:_misskey_followedMessage",
    "isCat": "misskey:isCat",
    "emojiReactions": {
      "@id": "fedibird:emojiReactions",
      "@type": "@id"
    }
  }
] as const

/** `Like`. */
export const LIKE_CONTEXT = [
  "https://w3id.org/identity/v1",
  "https://www.w3.org/ns/activitystreams",
  "https://w3id.org/security/data-integrity/v1",
  "https://gotosocial.org/ns",
  {
    "toot": "http://joinmastodon.org/ns#",
    "Emoji": "toot:Emoji"
  }
] as const

/** `EmojiReact`. */
export const EMOJI_REACT_CONTEXT = [
  "https://w3id.org/identity/v1",
  "https://www.w3.org/ns/activitystreams",
  "https://w3id.org/security/data-integrity/v1",
  "https://gotosocial.org/ns",
  {
    "litepub": "http://litepub.social/ns#",
    "toot": "http://joinmastodon.org/ns#",
    "EmojiReact": "litepub:EmojiReact",
    "Emoji": "toot:Emoji"
  }
] as const

export type JsonLdContext = readonly unknown[]

/** Returns `{ "@context": context, ...document }`. */
export function withActivityPubContext(context: JsonLdContext, document: JsonObject): JsonObject {
  const { "@context": _ignored, ...rest } = document
  return { "@context": context as unknown as JsonObject["@context"], ...rest }
}

/** Wire form for delivery: public collection aliases expanded to the full IRI. */
export function toDeliveryDocument(context: JsonLdContext, document: JsonObject): JsonObject {
  return expandPublicCollection(withActivityPubContext(context, document))
}
