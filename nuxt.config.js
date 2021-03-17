const path = require('path')
const moment = require('moment')
const util = require('util')
const exec = util.promisify(require('child_process').exec)
const copyfiles = require('copyfiles')

export default {
  target: 'static',
  /*
  ** Headers of the page
  */
  head: {
    title: process.env.npm_package_name || '',
    meta: [
      { charset: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { hid: 'description', name: 'description', content: process.env.npm_package_description || '' }
    ],
    link: [
      { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
      { hid: 'material-icon-css', rel: 'stylesheet', href: 'https://fonts.googleapis.com/icon?family=Material+Icons' },
      { hid: 'prism-theme', rel: 'stylesheet', href: '/css/prism-synthwave84.css' }
    ]
  },
  /*
  ** Customize the progress-bar color
  */
  loading: { color: '#fff' },
  /*
  ** Global CSS
  */
  css: [
  ],
  /*
  ** Plugins to load before mounting the App
  */
  plugins: [
  ],
  /*
  ** Nuxt.js dev-modules
  */
  buildModules: [
    // Doc: https://github.com/nuxt-community/nuxt-tailwindcss
    '@nuxtjs/tailwindcss',
  ],
  /*
  ** Nuxt.js modules
  */
  modules: [
    '@nuxtjs/moment',
    '@nuxtjs/pwa',
    '@nuxtjs/dotenv',
    '@nuxt/content',
    ['@pivale/nuxt-image-loader-module', {
      imagesBaseDir: 'content',
      imageStyles: {
        thumbnail: { actions: ['gravity|Center', 'resize|320|180^', 'extent|320|180|+0|+90'] },
        small: { macros: ['scaleAndCrop|160|90'] },
        medium: { macros: ['scaleAndCrop|320|180'] },
        large: { macros: ['scaleAndCrop|800|600'] },
      },
      forceGenerateImages: {
        thumbnail: '**/*.{jpg,jpeg,gif,png}',
        small: '**/*.{jpg,jpeg,gif,png}',
        medium: '**/*.{jpg,jpeg,gif,png}',
        large: '**/*.{jpg,jpeg,gif,png}'
      },
      responsiveStyles: {
        thumb: {
          srcset: 'small 160w, medium 320w, large 800w',
          sizes: '(min-width: 1280px) 100vw, 50vw',
        }
      },
    }],
    ['@nuxtjs/firebase', {
      config: {
        apiKey: "AIzaSyDDa2rNNA_iN3anKTzt5i8bf83ACir5uno",
        authDomain: "changkyun-kim.firebaseapp.com",
        databaseURL: "https://changkyun-kim.firebaseio.com",
        projectId: "changkyun-kim",
        storageBucket: "changkyun-kim.appspot.com",
        messagingSenderId: "871650378107",
        appId: "1:871650378107:web:372f9548992e0b5ea87dde",
        measurementId: "G-9MYK3SBZKL"
      },
      services: {
        auth: {
          static: true,
          preload: true,
          initialize: {
            onAuthStateChangedMutation: 'setUser'
          }
        },
        analytics: {
          static: true,
          preload: true
        }
      },
      static: true
    }]
  ],
  tailwindcss: {
    // jit: true,
    viewer: false,
    config: {
      purge: {
        content: [
          'content/**/*.md'
        ]
      }
    }
  },
  content: {
    markdown: {
      prism: {
        theme: 'static/css/prism-synthwave84.css'
      }
    }
  },
  hooks: {
    'content:file:beforeInsert': async document => {
      if (document.extension === '.md') {
        try {
          const contentPath = `content${document.path}${document.extension}`
          const { stdout } = await exec(`git log -1 --format=%cd --date=iso ${contentPath}`)
          // 2020-06-30 00:33:07 +0900
          const [date, time] = stdout.split(' ', 2)
          const iso8601 = [date, time.replace(' ', '')].join('T')
          document.updatedAt = moment(iso8601).toDate()
          console.log('hook created date', contentPath, iso8601)
        } catch (e) {
          // noop
        }
      }
    },
    'generate:before': (generator, generateOptions) => {
      copyfiles(['content/**/*.jpg', 'content/**/*.gif', 'content/**/*.png', 'static'], {
        error: false
      }, () => {})
    }
  },
  /*
  ** Build configuration
  */
  build: {
    /*
    ** You can extend webpack config here
    */
    extend (config, ctx) {
    }
  }
}
