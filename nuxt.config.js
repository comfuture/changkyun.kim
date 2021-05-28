const path = require('path')
const moment = require('moment')
const util = require('util')
const exec = util.promisify(require('child_process').exec)
const copyfiles = require('copyfiles')

const isDev = process.env.NODE_ENV !== 'production'

export default {
  target: isDev ? 'server' : 'static',
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
    '@nuxt/image'
  ],
  /*
  ** Nuxt.js modules
  */
  modules: [
    '@nuxtjs/moment',
    '@nuxtjs/pwa',
    '@nuxtjs/dotenv',
    '@nuxt/content',
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
  image: {
    provider: 'static',
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
