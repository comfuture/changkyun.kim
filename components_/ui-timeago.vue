<template>
  <time class="ui" :datetime="value" :title="formatted">
    {{ related }}
  </time>
</template>
<script>
import Vue from 'vue'
export default Vue.extend({
  props: {
    value: {
      type: [String, Date],
      required: true
    },
    ago: {
      type: Boolean,
      default: false
    }
  },
  computed: {
    dateValue() {
      return typeof this.value === 'string'
        ? new Date(Date.parse(this.value))
        : this.value
    },
    formatted() {
      const options = {
        year: 'numeric', month: 'numeric', day: 'numeric',
        hour: 'numeric', minute: 'numeric'
      };
      return Intl.DateTimeFormat('ko', options).format(this.dateValue);
    },
    related() {
      const rtf = new Intl.RelativeTimeFormat('ko', {
          localeMatcher: 'best fit',
          numeric: 'auto',
          style: 'long'
      });
      const diff = (new Date()).getTime() - this.dateValue.getTime();
      const days = 1000 * 60 * 60 * 24;
      if (diff > days * 6 * 30) { // XXX: 6개월보다 이전인 경우 그냥 날짜로 표시
        return this.formatted;
      }
      // const scales = new Map<number, Intl.RelativeTimeFormatUnit>([
      const scales = new Map([
        [365 * days, 'year'],
        [30 * days, 'month'],
        [days, 'day'],
        [1000 * 60 * 60, 'hour'],
        [1000 * 60, 'minute'],
        [1000, 'second']
        // [0, '__now__']  // how to format 'just now' in intl?
      ])
      for (const [scale, unit] of scales) {
        if (diff > scale) {
          return rtf.format(-Math.floor(diff / scale), unit)
        }
      }
      return 'just now';
    }
  }
})
</script>
