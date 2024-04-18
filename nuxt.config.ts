import { defineNuxtConfig } from 'nuxt/config'
// https://v3.nuxtjs.org/api/configuration/nuxt.config
export default defineNuxtConfig({
  typescript: {
    shim: false
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
    '@kevinmarrec/nuxt-pwa',
    "@nuxt/content",
    "@nuxtjs/tailwindcss",
    "@nuxt/image"
  ],
  tailwindcss: {
    viewer: false,
  },
  content: {
    highlight: {
      theme: 'github-dark-dimmed',
      preload: ['python', 'vue', 'vue-html']
    }
  },
  pwa: {
    workbox: {
      enabled: true,
    }
  },
  image: {
    provider: 'ipx',
    staticFilename: '[publicPath]/image/[name]-[hash][ext]',
    dir: 'content',
    presets: {
      thumbnail: {
        modifiers: {
          format: 'webp',
          width: 90,
          height: 90
        }
      },
      card: {
        provider: 'ipx',
        modifiers: {
          format: 'webp',
          width: 500,
          height: 500
        }
      },
      large: {
        modifiers: {
          format: 'webp',
          width: 1024
        }
      },
      cover: {
        modifiers: {
          format: 'webp',
          width: 1280,
          height: 400
        }
      }
    }
  },
})