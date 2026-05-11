import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { gunzipSync } from 'node:zlib'

type ContentCollection = 'blog' | 'app'

const contentDumpGeneratedPath = resolve(process.cwd(), '.data/contentDump.generated.ts')
const emptyContentDumps: Record<ContentCollection, string> = {
  blog: '',
  app: '',
}

const siteName = 'Changkyun Kim'
const siteDescription = '김창균(Changkyun Kim)은 대한민국 서울에 거주하는 개발자입니다. Developer based in Seoul, South Korea. Programming, principles, identity, languages, learning, and problem solving.'
const siteKeywords = '김창균, Changkyun Kim, 김창균 개발자, Changkyun Kim developer, 대한민국 서울, Seoul South Korea, 서울 개발자, Seoul developer, software developer, programming, 한국어, English, principles, problem solver'
const themeColor = '#ffffff'
const oneDay = 60 * 60 * 24
const remarkInferCodeLanguagePath = resolve(process.cwd(), 'app/utils/remarkInferCodeLanguage.mjs')

function writeContentDumpModule(dumps: Record<ContentCollection, string>) {
  mkdirSync(resolve(process.cwd(), '.data'), { recursive: true })
  const source = `const dumps = ${JSON.stringify(dumps)} as const\nexport default dumps\n`
  if (existsSync(contentDumpGeneratedPath) && readFileSync(contentDumpGeneratedPath, 'utf8') === source) {
    return
  }
  writeFileSync(contentDumpGeneratedPath, source)
}

writeContentDumpModule(emptyContentDumps)

function isContentDumpForCollection(lines: unknown, collection: ContentCollection) {
  return Array.isArray(lines)
    && lines.some((line) => typeof line === 'string' && line.includes(`_content_${collection}`))
}

function readContentDump(collection: ContentCollection) {
  const root = process.cwd()
  const candidates = [
    resolve(root, `.output/public/__nuxt_content/${collection}/sql_dump.txt`),
    resolve(root, `.output/public/dump.${collection}.sql`),
    resolve(root, `node_modules/.cache/nuxt/.nuxt/content/raw/dump.${collection}.sql`),
    resolve(root, `.nuxt/content/raw/dump.${collection}.sql`),
  ]

  for (const path of candidates) {
    if (!existsSync(path)) {
      continue
    }

    const dump = readFileSync(path, 'utf8')
    try {
      const lines = JSON.parse(gunzipSync(Buffer.from(dump.trim(), 'base64')).toString('utf8')) as unknown
      if (isContentDumpForCollection(lines, collection)) {
        return dump
      }
    } catch {
      continue
    }
  }

  throw new Error(`Unable to find a Nuxt Content dump for ${collection}. Tried: ${candidates.join(', ')}`)
}

export default defineNuxtConfig({
  alias: {
    '#content-dump-generated': contentDumpGeneratedPath,
  },
  typescript: {
    shim: false
  },
  nitro: {
    preset: 'cloudflare-module',
    esbuild: {
      options: {
        target: 'es2020'
      }
    },
    experimental: {
      database: true,
      tasks: true,
      openAPI: true
    },
    database: {
      default: {
        connector: 'cloudflare-d1',
        options: {
          bindingName: 'DB'
        }
      }
    },
    devDatabase: {
      default: {
        connector: 'better-sqlite3',
        options: {
          path: '.data/db.sqlite'
        }
      }
    },
    prerender: {
      crawlLinks: false,
      routes: ['/']
    }
  },
  routeRules: {
    '/blog': { prerender: false },
    '/blog/**': { prerender: false }
  },
  app: {
    head: {
      htmlAttrs: {
        lang: 'ko'
      },
      title: siteName,
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: siteDescription },
        { name: 'author', content: '김창균, Changkyun Kim' },
        { name: 'creator', content: '김창균, Changkyun Kim' },
        { name: 'publisher', content: '김창균, Changkyun Kim' },
        { name: 'keywords', content: siteKeywords },
        { name: 'application-name', content: siteName },
        { name: 'robots', content: 'index, follow, max-image-preview:large' },
        { name: 'theme-color', content: themeColor },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-title', content: siteName },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
        { property: 'og:type', content: 'website' },
        { property: 'og:title', content: siteName },
        { property: 'og:description', content: siteDescription },
        { property: 'og:site_name', content: siteName },
        { property: 'og:locale', content: 'ko_KR' },
        { property: 'og:locale:alternate', content: 'en_US' },
        { name: 'twitter:site', content: '@changkyun.kim' },
        { name: 'twitter:creator', content: '@changkyun.kim' },
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'shortcut icon', href: '/favicon.ico' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png', sizes: '180x180' },
        { rel: 'author', href: '/about' },
        { rel: 'me', href: 'https://bsky.app/profile/changkyun.kim' },
        { rel: 'sitemap', type: 'application/xml', href: '/sitemap.xml' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200' }
      ]
    },
    pageTransition: true
  },

  experimental: {
    payloadExtraction: false,
  },

  vite: {
    optimizeDeps: {
      include: []
    }
  },

  hooks: {
    'nitro:build:before'() {
      const dumps = {
        blog: readContentDump('blog'),
        app: readContentDump('app'),
      }
      writeContentDumpModule(dumps)
    },
    'vite:extendConfig'(config) {
      const include = config.optimizeDeps?.include

      if (Array.isArray(include)) {
        config.optimizeDeps!.include = include.filter((entry) => !entry.startsWith('@nuxtjs/mdc > '))
      }
    }
  },

  modules: [
    "@nuxt/content", "@nuxt/ui", "@nuxt/image", "@vite-pwa/nuxt", "@nuxt/eslint"
  ],

  pwa: {
    registerWebManifestInRouteRules: true,
    includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icon.png'],
    manifest: {
      name: '김창균 Changkyun Kim - Seoul Developer',
      short_name: siteName,
      description: siteDescription,
      lang: 'ko-KR',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      background_color: themeColor,
      theme_color: themeColor,
      icons: [
        {
          src: '/pwa-64x64.png',
          sizes: '64x64',
          type: 'image/png',
        },
        {
          src: '/pwa-192x192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: '/pwa-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: '/pwa-maskable-192x192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'maskable',
        },
        {
          src: '/pwa-maskable-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ],
    },
    workbox: {
      cleanupOutdatedCaches: true,
      navigateFallback: null,
      runtimeCaching: [
        {
          urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
          handler: 'StaleWhileRevalidate',
          options: {
            cacheName: 'google-font-stylesheets',
            expiration: {
              maxEntries: 8,
              maxAgeSeconds: oneDay * 30,
            },
            cacheableResponse: {
              statuses: [0, 200],
            },
          },
        },
        {
          urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'google-font-files',
            expiration: {
              maxEntries: 16,
              maxAgeSeconds: oneDay * 365,
            },
            cacheableResponse: {
              statuses: [0, 200],
            },
          },
        },
        {
          urlPattern: /\/api\/(?:blog\/(?:articles|article|tags)|app\/content)(?:\?.*)?$/i,
          handler: 'NetworkFirst',
          options: {
            cacheName: 'content-api',
            networkTimeoutSeconds: 3,
            expiration: {
              maxEntries: 64,
              maxAgeSeconds: oneDay,
            },
            cacheableResponse: {
              statuses: [200],
            },
          },
        },
        {
          urlPattern: /\/(?:_ipx|blog|app|image|content)\/.*\.(?:png|jpe?g|webp|gif|avif|svg)(?:\?.*)?$/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'content-images',
            expiration: {
              maxEntries: 96,
              maxAgeSeconds: oneDay * 30,
            },
            cacheableResponse: {
              statuses: [0, 200],
            },
          },
        },
      ],
    },
  },

  css: [
    "~/assets/css/tailwind.css"
  ],

  ui: {
    theme: {
      colors: ['primary', 'neutral', 'info', 'success', 'warning', 'error'],
      defaultVariants: {
        color: 'neutral',
        size: 'sm'
      }
    }
  },

  content: {
    build: {
      markdown: {
        remarkPlugins: {
          [remarkInferCodeLanguagePath]: {},
        },
        highlight: {
          theme: 'github-dark-dimmed',
          langs: ['json', 'js', 'javascript', 'yaml', 'yml', 'bash', 'shellscript', 'ts', 'typescript', 'vue', 'html', 'css', 'python', 'sql'],
        }
      },
    },
  },

  image: {
    format: ['webp', 'jpg', 'png'],
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
          fit: 'cover',
          width: 1280,
          height: 400,
        }
      }
    }
  },
  $production: {
    image: {
      provider: 'cloudflare',
      cloudflare: {
        baseURL: 'https://changkyun.kim'
      }
    }
  },
  compatibilityDate: '2025-02-28',
})
