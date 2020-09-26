<template>
  <div>
    <header>
      <nav class="topnav">
        <div class="container px-4 sm:px-0 mx-auto flex flex-wrap items-center justify-between">
          <div class="w-full relative flex justify-between md:w-auto md:static md:block md:justify-start">
            <n-link class="brand" to="/">Changkyun Kim</n-link>
            <button class="hamburger md:hidden block focus:outline-none" type="button" @click="toggleMenu">
              <span class="material-icons">dehaze</span>
            </button>
          </div>
          <div class="transition-all md:flex flex-grow items-center hidden" ref="topnav">
            <ul class="flex flex-col md:flex-row list-none md:ml-auto">
              <li><n-link to="/about" class="menu-item"><i class="material-icons">face</i><span class="ml-2">About</span></n-link></li>
              <li><n-link to="/article" class="menu-item"><i class="material-icons">subject</i><span class="ml-2">Articles</span></n-link></li>
              <li><a href="https://github.com/comfuture/changkyun.kim" class="menu-item" target="_blank">
                <!-- <i class="material-icons">code</i> -->
                <svg class="fill-current w-6 h-6" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                  <title>GitHub</title>
                  <path d="M10 0a10 10 0 0 0-3.16 19.49c.5.1.68-.22.68-.48l-.01-1.7c-2.78.6-3.37-1.34-3.37-1.34-.46-1.16-1.11-1.47-1.11-1.47-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.1-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.1.39-1.99 1.03-2.69a3.6 3.6 0 0 1 .1-2.64s.84-.27 2.75 1.02a9.58 9.58 0 0 1 5 0c1.91-1.3 2.75-1.02 2.75-1.02.55 1.37.2 2.4.1 2.64.64.7 1.03 1.6 1.03 2.69 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85l-.01 2.75c0 .26.18.58.69.48A10 10 0 0 0 10 0"></path>
                </svg>
                <span class="ml-2">Github</span></a></li>
              <li><n-link to="/contact" class="menu-item"><i class="material-icons">contact_mail</i><span class="ml-2">Contact</span></n-link></li>
            </ul>
          </div>
        </div>
      </nav>
    </header>
    <nuxt />
    <footer class="footer">
      <div class="container">
        Changkyun Kim &copy; 2020-
      </div>
    </footer>
  </div>
</template>
<script>
export default {
  name: 'default-layout',
  watch: {
    '$route'(val) {
      this.hideMenu()
    }
  },
  methods: {
    hideMenu() {
      this.$refs.topnav.classList.add('hidden')
    },
    toggleMenu() {
      this.$refs.topnav.classList.toggle('hidden')
    }
  }
}
</script>
<style lang="postcss">
/* purgecss ignore */
.page-enter-active, .page-leave-active {
  transition: opacity .35s;
}

.page-enter, .page-leave-to {
  opacity: 0;
}

.topnav {
  @apply fixed z-50 w-full bg-white top-0 flex flex-wrap items-center justify-between px-2 py-3 shadow-lg;
  .brand {
    @apply text-sm font-bold leading-relaxed inline-block mr-4 py-2 whitespace-no-wrap uppercase text-gray-800;
  }
  .hamburger {
    @apply cursor-pointer text-xl leading-none px-3 py-1 border border-solid border-transparent rounded bg-transparent outline-none;
  }

  .menu-item {
    @apply px-3 py-2 flex items-center text-xs uppercase font-bold text-gray-800;
    &:hover {
      @apply text-gray-600;
    }
  }
}

.leading {
  @apply mt-4 text-lg leading-relaxed text-gray-600;
}

footer.footer {
  @apply bg-gray-200;

  .container {
    @apply mx-auto py-8 text-center;
  }
}
</style>
