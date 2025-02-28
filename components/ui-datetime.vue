<script setup lang="ts">
const props = defineProps<{
  datetime: Date | string
}>()
let dt: Date;
if (typeof props.datetime === 'string') {
  dt = new Date(Date.parse(props.datetime))
} else {
  dt = props.datetime
}
const formatter = Intl.DateTimeFormat('ko-KR', {
  dateStyle: 'full',
  // timeStyle: 'short',
  timeZone: 'Asia/Seoul',
})
const dateString = formatter.format(dt)
</script>
<template>
  <time datetime="datetime">{{ dateString }}</time>
</template>
