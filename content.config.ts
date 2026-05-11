import { defineCollection, defineContentConfig, z } from "@nuxt/content";

export default defineContentConfig({
  collections: {
    blog: defineCollection({
      type: 'page',
      source: 'blog/**/*.md',
      schema: z.object({
        description: z.string().optional(),
        author: z.string().optional(),
        lang: z.string().optional(),
        keywords: z.array(z.string()).optional(),
        coverImage: z.string().url(),
        tags: z.array(z.string()),
        createdAt: z.date(),
      }),
    }),
    app: defineCollection({
      type: 'page',
      source: 'app/**/*.md',
      schema: z.object({
        description: z.string().optional(),
        author: z.string().optional(),
        lang: z.string().optional(),
        keywords: z.array(z.string()).optional(),
        coverImage: z.string().url(),
        tags: z.array(z.string()),
        createdAt: z.date(),
      }),
    }),
  },
});
