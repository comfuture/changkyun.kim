import { defineNuxtConfig } from 'nuxt/config'
// https://v3.nuxtjs.org/api/configuration/nuxt.config
export default defineNuxtConfig({
  typescript: {
    shim: false
  },
  // target: 'static',
  nitro: {
    preset: 'cloudflare'
  },
  head: {
    title: 'Changkyun Kim',
    meta: [
      { charset: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { hid: 'description', name: 'description', content: process.env.npm_package_description || '' }
    ],
    link: [
      { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
      { hid: 'material-icon-css', rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@48,400,0,0' }
    ]
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
    provider: 'ipx',
    ipx: {
      dir: 'ipx',
    },
    dir: 'content',
    presets: {
      thumbnail: {
        modifiers: {
          format: 'webp',
          width: 90,
          height: 90
        }
      },
      small: {
        modifiers: {
          format: 'webp',
          width: 160,
          height: 90
        }
      },
      medium: {
        modifiers: {
          format: 'webp',
          width: 320,
          height: 180
        }
      },
      large: {
        modifiers: {
          format: 'webp',
          width: 800,
          height: 600
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
