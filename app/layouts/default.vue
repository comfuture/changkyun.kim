<script setup lang="ts">
const navItems = [
  { label: 'About me', to: '/about' },
  { label: 'Articles', to: '/blog/' },
  { label: 'Contact', to: '/contact' },
]

const dropdownItems = [
  navItems.map((item) => ({ label: item.label, to: item.to }))
]
</script>
<template>
  <div class="site">
    <header class="site-header">
      <UContainer class="flex items-center justify-between gap-4 py-3">
        <UButton to="/" variant="ghost" class="text-base font-semibold uppercase tracking-wide">
          Changkyun Kim
        </UButton>
        <div class="flex items-center gap-2">
          <nav class="hidden md:flex items-center gap-2">
            <UButton
              v-for="item in navItems"
              :key="item.to"
              :to="item.to"
              variant="ghost"
              class="text-xs font-semibold uppercase"
            >
              {{ item.label }}
            </UButton>
          </nav>
          <UDropdown :items="dropdownItems" class="md:hidden">
            <UButton icon="i-heroicons-bars-3" variant="ghost" aria-label="Open menu" />
          </UDropdown>
        </div>
      </UContainer>
    </header>
    <main class="flex-1">
      <slot />
    </main>
    <footer class="site-footer">
      <UContainer class="py-6 text-sm text-gray-500 dark:text-gray-400">
        CopyRight &copy; 2022 Changkyun Kim
      </UContainer>
    </footer>
  </div>
</template>
<style lang="postcss">
.material-symbols-outlined {
  @apply align-middle;
  font-variation-settings:
    'FILL' 1,
    'wght' 400,
    'GRAD' 0,
    'opsz' 48
}

.page-enter-active,
.page-leave-active {
  transition: opacity .35s;
}

.page-enter-from,
.page-leave-to {
  opacity: 0;
}

body {
  @apply bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200;
}

.site {
  @apply min-h-screen flex flex-col;
}

.site-header {
  @apply sticky top-0 z-50 border-b border-gray-200/70 dark:border-gray-700/60;
  @apply bg-white/70 dark:bg-gray-800/70 backdrop-blur;
}

.site-footer {
  @apply border-t border-gray-200 dark:border-gray-700;
}
</style>
