import { computed, ref, unref, watchEffect } from 'vue'
import { useDevicePixelRatio, useWindowSize } from '@vueuse/core'
import { useImage } from '#imports'

type SrcSetOptions = {
  preset?: string
  sizes?: string
  densities?: string
  modifiers?: Record<string, string | number | undefined>
}

type SrcSetCandidate = {
  url: string
  width?: number
  density?: number
}

const parseSrcSet = (srcset?: string) => {
  if (!srcset) return []
  return srcset
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [url, size] = entry.split(/\s+/)
      if (!url) return null
      if (!size) return { url }
      if (size.endsWith('w')) {
        return { url, width: Number.parseInt(size, 10) }
      }
      if (size.endsWith('x')) {
        return { url, density: Number.parseFloat(size) }
      }
      return { url }
    })
    .filter((item): item is SrcSetCandidate => Boolean(item?.url))
}

const pickByWidth = (candidates: SrcSetCandidate[], targetWidth: number) => {
  const sorted = candidates
    .filter((c) => typeof c.width === 'number')
    .sort((a, b) => (a.width as number) - (b.width as number))
  if (!sorted.length) return undefined
  return sorted.find((c) => (c.width as number) >= targetWidth) || sorted[sorted.length - 1]
}

const pickByDensity = (candidates: SrcSetCandidate[], dpr: number) => {
  const sorted = candidates
    .filter((c) => typeof c.density === 'number')
    .sort((a, b) => (a.density as number) - (b.density as number))
  if (!sorted.length) return undefined
  return sorted.find((c) => (c.density as number) >= dpr) || sorted[sorted.length - 1]
}

export const useImageSrcSet = (src: string | Ref<string | undefined>, options: SrcSetOptions | Ref<SrcSetOptions> = {}) => {
  const img = useImage()
  const el = ref<HTMLElement | null>(null)
  const { width } = useWindowSize()
  const { pixelRatio } = useDevicePixelRatio()

  const sources = computed(() => {
    const resolvedSrc = unref(src)
    if (!resolvedSrc) return undefined
    const resolvedOptions = unref(options)
    return img.getSizes(resolvedSrc, resolvedOptions)
  })

  const selectedUrl = computed(() => {
    const fallback = sources.value?.src || unref(src)
    const candidates = parseSrcSet(sources.value?.srcset)
    if (!candidates.length) return fallback

    const dpr = pixelRatio.value || 1
    const viewportWidth = width.value || 0
    const targetWidth = viewportWidth ? viewportWidth * dpr : 0

    const byWidth = targetWidth ? pickByWidth(candidates, targetWidth) : undefined
    if (byWidth?.url) return byWidth.url

    const byDensity = pickByDensity(candidates, dpr)
    if (byDensity?.url) return byDensity.url

    return fallback
  })

  const style = computed(() => {
    if (import.meta.server) return {}
    if (!selectedUrl.value) return {}
    return { backgroundImage: `url('${selectedUrl.value}')` }
  })

  if (import.meta.client) {
    watchEffect(() => {
      if (!el.value) return
      el.value.style.backgroundImage = selectedUrl.value ? `url('${selectedUrl.value}')` : ''
    })
  }

  return {
    bind: { ref: el },
    el,
    style,
    src: computed(() => sources.value?.src),
    srcset: computed(() => sources.value?.srcset),
    sizes: computed(() => sources.value?.sizes),
  }
}
