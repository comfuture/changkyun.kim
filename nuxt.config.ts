import { defineNuxtConfig } from 'nuxt/config'
// https://v3.nuxtjs.org/api/configuration/nuxt.config
export default defineNuxtConfig({
  typescript: {
    shim: false
  },
  target: 'static',
  nitro: {
    preset: 'vercel'
  },
  app: {
    head: {
      htmlAttrs: {
        lang: 'ko'
      },
      title: 'Changkyun Kim',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { hid: 'description', name: 'description', content: process.env.npm_package_description || '' }
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200' }
      ]
    },
  },
  pageTransition: {page: true},
  modules: [
    "@nuxt/content",
    "@nuxt/image-edge",
    "@nuxtjs/tailwindcss"
  ],
  content: {
    highlight: {
      theme: 'github-dark-dimmed',
      preload: ['python', 'vue', 'vue-html']
    }
  },
  image: {
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
