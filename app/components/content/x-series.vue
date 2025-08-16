<script setup lang="ts">
const props = defineProps<{
  tags?: string;
}>();
</script>
<template>
  <div>
    <content-list :query="{tags: props.tags}" v-slot="{ items }" v-if="props.tags">
      series:
      <ul>
        <li v-for="({doc}) in items" :key="doc.slug">
          <nuxt-link :to="`/article/${doc.slug}`">
            {{ doc.title }}
          </nuxt-link>
        </li>
      </ul>
    </content-list>
  </div>
</template>