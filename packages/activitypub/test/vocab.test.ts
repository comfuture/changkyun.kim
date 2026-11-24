import assert from "node:assert/strict"
import { describe, test } from "node:test"

import {
  PUBLIC_COLLECTION,
  asArray,
  audienceOf,
  expandPublicCollection,
  firstId,
  firstUrl,
  hasType,
  ids,
  imageUrl,
  isActor,
  isPubliclyAddressed,
  languageValue,
  normalizeInstant,
  nowInstant,
  stripEnvelope,
  tryNormalizeInstant,
  typesOf,
} from "../src/index.ts"

describe("vocabulary readers", () => {
  test("single values, arrays, embedded objects and @id", () => {
    assert.deepEqual(asArray(undefined), [])
    assert.deepEqual(asArray("a"), ["a"])
    assert.deepEqual(asArray(["a", ["b"]]), ["a", "b"])
    assert.deepEqual(asArray({ "@list": ["x"] }), ["x"])
    assert.deepEqual(ids(["https://a.example/1", { id: "https://a.example/2" }, { "@id": "https://a.example/3" }, 5]), [
      "https://a.example/1",
      "https://a.example/2",
      "https://a.example/3",
    ])
    assert.equal(firstId({ id: "https://a.example/actor", type: "Person" }), "https://a.example/actor")
    assert.equal(firstId(null), null)
  })

  test("type names with prefixes", () => {
    assert.deepEqual(typesOf({ type: "as:Note" }), ["Note"])
    assert.deepEqual(typesOf({ "@type": "https://www.w3.org/ns/activitystreams#Article" }), ["Article"])
    assert.deepEqual(typesOf({ type: ["Create", "litepub:EmojiReact"] }), ["Create", "EmojiReact"])
    assert.equal(hasType({ type: "http://litepub.social/ns#EmojiReact" }, "EmojiReact"), true)
    assert.equal(hasType({ type: "Note" }, "Article", "Note"), true)
    assert.equal(isActor({ id: "https://a.example/u", type: "Service" }), true)
    assert.equal(isActor({ id: "https://a.example/u", type: "Note" }), false)
    assert.equal(isActor({ type: "Person" }), false)
  })

  test("public collection aliases", () => {
    for (const alias of [PUBLIC_COLLECTION, "as:Public", "Public"]) {
      assert.equal(isPubliclyAddressed({ to: alias }), true, alias)
      assert.equal(isPubliclyAddressed({ cc: [{ id: alias }] }), true, alias)
    }
    assert.equal(isPubliclyAddressed({ to: ["https://a.example/followers"] }, { cc: [] }), false)
    assert.equal(isPubliclyAddressed({ to: [] }, { cc: "as:Public" }), true)
    assert.deepEqual(audienceOf({ to: "a", cc: ["b"], bcc: "c" }), ["a", "b"])
  })

  test("natural language values and language maps", () => {
    assert.equal(languageValue({ content: "<p>hi</p>" }, "content"), "<p>hi</p>")
    assert.equal(languageValue({ content: { "@value": "hello", "@language": "en" } }, "content"), "hello")
    assert.equal(languageValue({ content: [{ "@value": "a" }, "b"] }, "content"), "a")
    assert.equal(languageValue({ contentMap: { ko: "안녕", en: "hi" } }, "content"), "안녕")
    assert.equal(languageValue({ nameMap: { und: ["x"] } }, "name"), "x")
    assert.equal(languageValue({}, "summary"), null)
  })

  test("urls and images", () => {
    assert.equal(firstUrl("https://a.example/x"), "https://a.example/x")
    assert.equal(firstUrl([{ type: "Link", href: "https://a.example/l" }, "https://a.example/2"]), "https://a.example/l")
    assert.equal(firstUrl({ id: "https://a.example/o" }), "https://a.example/o")
    assert.equal(imageUrl({ type: "Image", url: "https://a.example/i.png" }), "https://a.example/i.png")
    assert.equal(imageUrl([{ type: "Image", url: { type: "Link", href: "https://a.example/j.png" } }]), "https://a.example/j.png")
    assert.equal(imageUrl("https://a.example/k.png"), "https://a.example/k.png")
    assert.equal(imageUrl(null), null)
  })

  test("envelope stripping and public collection expansion", () => {
    assert.deepEqual(stripEnvelope({ "@context": "x", signature: {}, id: "a" }), { id: "a" })
    assert.deepEqual(
      expandPublicCollection({ "@context": ["as:Public"], to: "as:Public", cc: ["https://a.example/f", "Public"], object: { to: "as:Public", content: "as:Public" } }),
      { "@context": ["as:Public"], to: PUBLIC_COLLECTION, cc: ["https://a.example/f", PUBLIC_COLLECTION], object: { to: PUBLIC_COLLECTION, content: "as:Public" } },
    )
  })
})

describe("instant normalization (Temporal.Instant#toString compatible)", () => {
  test("normalizes offsets and fractional seconds", () => {
    assert.equal(normalizeInstant("2026-01-02T03:04:05+09:00"), "2026-01-01T18:04:05Z")
    assert.equal(normalizeInstant("2026-01-02T03:04:05.120Z"), "2026-01-02T03:04:05.12Z")
    assert.equal(normalizeInstant("2026-01-02T03:04:05.000Z"), "2026-01-02T03:04:05Z")
    assert.equal(normalizeInstant("2026-01-02T03:04:05.123456789Z"), "2026-01-02T03:04:05.123456789Z")
    assert.equal(normalizeInstant("2026-01-02T03:04Z"), "2026-01-02T03:04:00Z")
    assert.equal(normalizeInstant("2026-01-01T00:30:00-01:30"), "2026-01-01T02:00:00Z")
    assert.equal(normalizeInstant("2025-12-31t23:59:59+0100"), "2025-12-31T22:59:59Z")
  })

  test("rejects values Temporal rejects", () => {
    for (const value of ["2026-01-02", "not a date", "2026-01-02T03:04:05", "2026-02-30T00:00:00Z", "2026-13-01T00:00:00Z"]) {
      assert.throws(() => normalizeInstant(value), RangeError, value)
      assert.equal(tryNormalizeInstant(value), null)
    }
    assert.equal(tryNormalizeInstant(42), null)
  })

  test("now", () => {
    assert.equal(nowInstant(new Date("2026-05-06T07:08:09.100Z")), "2026-05-06T07:08:09.1Z")
  })
})
