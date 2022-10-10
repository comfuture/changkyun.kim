import type { RouterOptions } from '@nuxt/schema'
// https://router.vuejs.org/api/interfaces/routeroptions.html
export default <RouterOptions> {
  scrollBehavior(to, from, savedPosition) {
    // `to` and `from` are both route locations
    // `savedPosition` can be null if there isn't one
    const nuxt = useNuxtApp()
    nuxt.hook('page:finish', () => {
      setTimeout(() => {
        window?.scrollTo({ top: 0})
      }, 351)
    })
  }
}