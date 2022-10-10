<script setup lang="ts">
const { params: { tag } } = useRoute()
</script>
<template>
  <main>
    <h2>{{ tag }}에 대한 글들</h2>
    <p>
      {{ tag }} ...
    </p>
  </main>
</template>
