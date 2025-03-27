import { defineNuxtConfig } from 'nuxt/config'
// https://v3.nuxtjs.org/api/configuration/nuxt.config
export default defineNuxtConfig({
  typescript: {
    shim: false
  },

  nitro: {
    experimental: {
      openAPI: true
    }
  },

  // ssr: false,
  app: {
    head: {
      htmlAttrs: {
        lang: 'ko'
      },
      title: 'Changkyun Kim',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Changkyun Kim' },
        { name: 'theme-color', content: '#FFF' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { property: 'og:type', content: 'website' },
        { property: 'og:title', content: 'Changkyun Kim' },
        { property: 'og:site_name', content: 'Changkyun Kim' },
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'shortcut icon', href: '/favicon.ico' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200' }
      ]
    },
    pageTransition: true
  },

  experimental: {
    payloadExtraction: false,
  },

  modules: [
    "@nuxt/content", "@nuxtjs/tailwindcss", "@nuxt/image", "@justway/nuxt",
    "@nuxthub/core"
  ],

  content: {
    build: {
      markdown: {
        highlight: {
          theme: 'github-dark-dimmed',
          preload: ['python', 'typescript', 'vue', 'vue-html'],
        }
      },
    },
  },

  image: {
    provider: process.env.DEV ? 'ipx' : 'cloudflare',
    cloudflare: {
      baseURL: 'https://changkyun.kim'
    },
    presets: {
      thumbnail: {
        modifiers: {
          width: 90,
          height: 90
        }
      },

      cover: {
        modifiers: {
          width: 1280
        }
      }
    }
  },

  compatibilityDate: '2025-02-28',
})