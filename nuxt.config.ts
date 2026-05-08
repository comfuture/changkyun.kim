import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { gunzipSync } from 'node:zlib'

type ContentCollection = 'blog' | 'app'

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
      title: 'Changkyun Kim',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Changkyun Kim, 김창균, 金昌均' },
        { name: 'theme-color', content: '#FFF' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { property: 'og:type', content: 'website' },
        { property: 'og:title', content: 'Changkyun Kim, 김창균, 金昌均' },
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
      const generatedDir = resolve(process.cwd(), 'server/utils')
      mkdirSync(generatedDir, { recursive: true })
      writeFileSync(
        resolve(generatedDir, 'contentDump.generated.ts'),
        `const dumps = ${JSON.stringify(dumps)} as const\nexport default dumps\n`
      )
    },
    'vite:extendConfig'(config) {
      const include = config.optimizeDeps?.include

      if (Array.isArray(include)) {
        config.optimizeDeps!.include = include.filter((entry) => !entry.startsWith('@nuxtjs/mdc > '))
      }
    }
  },

  modules: [
    "@nuxt/content", "@nuxt/ui", "@nuxt/image"
  ],

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
        highlight: {
          theme: 'github-dark-dimmed',
          langs: ['json', 'js', 'javascript', 'yaml', 'yml', 'bash', 'shellscript', 'ts', 'typescript', 'vue', 'html'],
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
