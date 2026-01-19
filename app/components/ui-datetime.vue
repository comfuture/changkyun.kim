<script setup lang="ts">
const props = defineProps<{
  datetime: Date | string
}>()
let dt: Date
if (typeof props.datetime === 'string') {
  dt = new Date(Date.parse(props.datetime))
} else {
  dt = props.datetime
}
const formatter = Intl.DateTimeFormat('ko-KR', {
  dateStyle: 'full',
  timeZone: 'Asia/Seoul',
})
const dateString = formatter.format(dt)
</script>
<template>
  <UBadge variant="subtle" color="neutral" class="text-xs">
    <time :datetime="dt.toISOString()">{{ dateString }}</time>
  </UBadge>
</template>
