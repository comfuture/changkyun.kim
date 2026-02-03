<script setup lang="ts">
const navItems = [
  { label: 'About me', to: '/about' },
  { label: 'Articles', to: '/blog/' },
  { label: 'Contact', to: '/contact' },
]
</script>
<template>
  <div>
    <UHeader
      :ui="{
        container: 'flex items-center gap-3 h-full w-full',
        left: 'flex items-center gap-1.5 shrink-0 lg:flex-none',
        center: 'hidden lg:flex flex-1 justify-end',
        right: 'flex items-center gap-1.5 shrink-0 lg:flex-none',
      }"
    >
      <template #left>
        <ULink to="/" class="text-base font-semibold uppercase tracking-wide">
          Changkyun Kim
        </ULink>
      </template>
      <UNavigationMenu :items="navItems" class="w-full justify-end uppercase" />
      <template #right>
        <UColorModeSwitch />
      </template>
      <template #body>
        <UNavigationMenu :items="navItems" orientation="vertical" class="-mx-2.5 uppercase" />
      </template>
    </UHeader>
    <NuxtPage />
    <UFooter>
      <template #left>
        <p class="text-sm text-muted">Copyright © 2022 Changkyun Kim</p>
      </template>
    </UFooter>
  </div>
</template>
