import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useHead, useRoute, useSeoMeta } from '#imports'
import { resolveSiteUrl } from '~/utils/siteIdentity'

const DEFAULT_IMAGE = '/image/article-cover.jpg'
const OG_IMAGE_WIDTH = 1200
const OG_IMAGE_HEIGHT = 630

type SiteOgImageMetaOptions = {
  image?: MaybeRefOrGetter<string | null | undefined>
  alt?: MaybeRefOrGetter<string | null | undefined>
}

function resolveImageType(path: string) {
  const pathname = path.toLowerCase().split('?')[0] ?? ''
  if (pathname.endsWith('.png')) {
    return 'image/png'
  }

  return 'image/jpeg'
}

function resolveOgImageUrl(image?: string | null) {
  const value = image || DEFAULT_IMAGE

  if (/^https?:\/\//i.test(value)) {
    return value
  }

  const path = value.startsWith('/') ? value : `/${value}`
  if (path.startsWith('/cdn-cgi/image/')) {
    return resolveSiteUrl(path)
  }

  return resolveSiteUrl(`/cdn-cgi/image/fit=cover,w=${OG_IMAGE_WIDTH},h=${OG_IMAGE_HEIGHT}${path}`)
}

export function useSiteOgImageMeta(options: SiteOgImageMetaOptions = {}) {
  const route = useRoute()
  const sourceImage = computed(() => toValue(options.image) || DEFAULT_IMAGE)
  const imageUrl = computed(() => resolveOgImageUrl(sourceImage.value))
  const imageType = computed(() => resolveImageType(sourceImage.value))
  const imageAlt = computed(() => toValue(options.alt) || 'Changkyun Kim')

  useSeoMeta({
    ogUrl: () => resolveSiteUrl(route.path),
    ogImage: () => imageUrl.value,
    ogImageWidth: OG_IMAGE_WIDTH,
    ogImageHeight: OG_IMAGE_HEIGHT,
    ogImageType: () => imageType.value,
    ogImageAlt: () => imageAlt.value,
    twitterCard: 'summary_large_image',
    twitterImage: () => imageUrl.value,
    twitterImageAlt: () => imageAlt.value,
  })

  useHead(() => ({
    link: [
      {
        rel: 'canonical',
        href: resolveSiteUrl(route.path),
      },
      {
        rel: 'alternate',
        hreflang: 'ko-KR',
        href: resolveSiteUrl(route.path),
      },
      {
        rel: 'alternate',
        hreflang: 'en',
        href: resolveSiteUrl(route.path),
      },
      {
        rel: 'alternate',
        hreflang: 'x-default',
        href: resolveSiteUrl(route.path),
      },
      {
        rel: 'image_src',
        href: imageUrl.value,
      },
    ],
    meta: [
      {
        property: 'og:image:secure_url',
        content: imageUrl.value,
      },
      {
        property: 'og:image:url',
        content: imageUrl.value,
      },
    ],
  }))
}
