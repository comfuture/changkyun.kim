<template>
  <ul class="p-2">
    <li v-for="item in items" :key="item.path">
      {{ item.title }}
    </li>
  </ul>
</template>
<script>
export default {
  name: 'aside-archive',
  data() {
    return {
      items: []
    }
  },
  async fetch() {
    this.items = await this.$content('article', {deep: true})
      .only(['title', 'path'])
      .sortBy('createdAt', 'desc')
      .fetch()
  }
}
</script>
