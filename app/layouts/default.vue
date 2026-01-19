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
  vertical-align: middle;
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
  background-color: #ffffff;
  color: #111827;
}

.dark body {
  background-color: #1f2937;
  color: #e5e7eb;
}

.site {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.site-header {
  position: sticky;
  top: 0;
  z-index: 50;
  border-bottom: 1px solid rgba(229, 231, 235, 0.7);
  background-color: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(12px);
}

.dark .site-header {
  border-bottom-color: rgba(55, 65, 81, 0.6);
  background-color: rgba(31, 41, 55, 0.7);
}

.site-footer {
  border-top: 1px solid #e5e7eb;
}

.dark .site-footer {
  border-top-color: #374151;
}
</style>
