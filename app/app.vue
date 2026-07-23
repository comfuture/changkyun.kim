<script setup lang="ts">
import { buildPersonJsonLd, buildWebsiteJsonLd, siteDescription, siteIdentity, siteKeywords } from '~/utils/siteIdentity'

useSeoMeta({
  description: siteDescription,
  author: `${siteIdentity.koreanName}, ${siteIdentity.legalName}`,
})

useHead({
  meta: [
    {
      name: 'keywords',
      content: siteKeywords.join(', '),
    },
  ],
  script: [
    {
      key: 'identity-person-json-ld',
      type: 'application/ld+json',
      innerHTML: JSON.stringify(buildPersonJsonLd()),
    },
    {
      key: 'identity-website-json-ld',
      type: 'application/ld+json',
      innerHTML: JSON.stringify(buildWebsiteJsonLd()),
    },
  ],
})
</script>

<template>
  <NuxtPwaManifest />
  <NuxtLayout />
</template>
