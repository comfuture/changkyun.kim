<script setup lang="ts">
const { fullPath } = useRoute()
</script>
<template>
  <section>
    <content-doc :path="fullPath" v-slot="{ doc }">
      <article class="container">
        <h1>{{ doc.title }}</h1>
        <time datetime="doc.createdAt">{{ doc.createdAt }}</time>
        <section class="content">
          <ContentRenderer :value="doc" />
        </section>
      </article>
    </content-doc>
  </section>
</template>
<style lang="postcss">
  article {
    @apply p-4;
    h1 {
      @apply text-xl font-bold;
    }

    .content {
      pre {
        @apply bg-gray-800 my-4 p-4 rounded;
      }
    }
  }
</style>