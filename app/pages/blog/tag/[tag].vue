<script setup lang="ts">
const { params: { tag } } = useRoute()
</script>
<template>
  <main>
    <UCard class="p-6 md:p-8">
      <h2 class="text-xl font-semibold">{{ tag }}에 대한 글들</h2>
      <p class="mt-2 text-sm text-gray-500">
        {{ tag }} ...
      </p>
    </UCard>
  </main>
</template>
