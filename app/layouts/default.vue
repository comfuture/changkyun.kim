<script setup lang="ts">
const navItems = [
  { label: 'About me', to: '/about' },
  { label: 'Articles', to: '/blog/' },
  { label: 'Contact', to: '/contact' },
]
</script>
<template>
  <div>
    <UHeader title="Changkyun Kim">
      <template #title>
        <UButton to="/" variant="ghost" class="text-base font-semibold uppercase tracking-wide">
          Changkyun Kim
        </UButton>
      </template>
      <UNavigationMenu :items="navItems" class="flex-1 justify-center" />
      <template #right>
        <UColorModeSwitch />
      </template>
      <template #body>
        <UNavigationMenu :items="navItems" orientation="vertical" class="-mx-2.5" />
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
