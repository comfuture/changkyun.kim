<script setup lang="ts">
definePageMeta({
  name: 'default-layout',
})

onMounted(() => {
  // observe whether globla nav is stuck
  const observer = new IntersectionObserver(
    ([e]) => {
      if (e.intersectionRatio < 1) {
        e.target.classList.add('stuck')
      } else {
        e.target.classList.remove('stuck')
      }
    },
    { threshold: [1] }
  );

  const head: HTMLHeadElement | null = document.querySelector('.site > header');
  if (head) {
    observer.observe(head);
  }

  // dark theme
  // if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
  //   document.documentElement.classList.add('dark')
  // } else {
  //   document.documentElement.classList.remove('dark')
  // }
})
</script>
<template>
  <div class="site">
    <header>
      <div class="container">
        <h1>
          <nuxt-link to="/">Changkyun Kim</nuxt-link>
        </h1>
        <nav>
          <hamburger-button />
          <menu>
            <li>
              <nuxt-link to="/about">About me</nuxt-link>
            </li>
            <li>
              <nuxt-link to="/article">Articles</nuxt-link>
            </li>
            <li>
              <nuxt-link to="/contact">Contact</nuxt-link>
            </li>
          </menu>
        </nav>
      </div>
    </header>
    <slot />
    <footer>
      <div class="container">
        CopyRight &copy; 2022 Changkyun Kim
      </div>
    </footer>
  </div>
</template>
<style lang="postcss">
.material-symbols-outlined {
  @apply align-middle;
  font-variation-settings:
  'FILL' 1,
  'wght' 400,
  'GRAD' 0,
  'opsz' 48
}

.page-enter-active, .page-leave-active {
  transition: opacity .35s;
}

.page-enter-from, .page-leave-to {
  opacity: 0;
}

body {
  @apply bg-white dark:bg-gray-800 dark:text-gray-200;
}
.site {
  @apply flex flex-col justify-items-stretch min-h-screen;
  >header {
    @apply sticky top-[-1px] p-4 z-50;
    @apply bg-white/40 dark:bg-gray-600/40 shadow-lg h-[56px] backdrop-blur;

    /* &.stuck {
      @apply bg-white/40 dark:bg-gray-600/40 shadow-lg h-[56px] backdrop-blur;
    } */

    .container {
      @apply mx-auto flex justify-between;

      h1 {
        @apply font-semibold uppercase;
      }

      nav {
        @apply flex flex-col gap-2 items-end;

        menu {
          @apply absolute mt-6 border rounded shadow py-4 px-8;
          @apply opacity-0 md:relative md:mt-0 md:border-0 md:shadow-none md:p-0;
          @apply md:flex md:opacity-100 flex-col md:flex-row gap-2 md:gap-4;
          @apply uppercase text-sm text-gray-700 dark:text-gray-300 font-semibold;
        }

        button.active.hamburger+menu {
          @apply flex opacity-100 bg-white transition transition-all;
        }
      }
    }
  }

  >main {
    @apply flex-grow;
  }

  >footer {
    @apply border-t border-gray-200 dark:border-gray-600 p-4;

    .container {
      @apply mx-auto;
    }
  }
}
</style>
