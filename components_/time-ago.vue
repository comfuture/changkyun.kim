<template>
  <span class="created-at">
    <i class="material-icons">access_time</i>{{ formatted }}
  </span>
</template>
<script>
export default {
  name: 'time-ago',
  props: ['date'],
  data(value) {
    return {
      formatted: this.$moment(this.date).format('ll')
    }
  },
  mounted() {
    if (!window.$$tick) {
      window.$$tick = setInterval(() => {
        this.$root.$emit('update-timeago')
      }, 1000)
    }
    this.$root.$on('update-timeago', this.updateFormatted)
    this.updateFormatted()
  },
  methods: {
    updateFormatted() {
      this.formatted = this.$moment(this.date).fromNow()
    }
  }
}
</script>
<style lang="postcss" scoped>
i.material-icons {
  @apply align-middle mr-1;
}
</style>