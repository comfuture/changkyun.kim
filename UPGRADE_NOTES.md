# Nuxt 4 Upgrade Notes

## Successfully Upgraded to Nuxt 4.0.0

This project has been successfully upgraded from Nuxt 3.17.6 to Nuxt 4.0.0.

### Changes Made:

1. **Core Dependencies Updated:**
   - `nuxt`: `^3.17.6` → `^4.0.0`
   - `@nuxt/content`: `^3.6.1` → `^3.6.3`
   - `@nuxt/image`: `^1.9.0` → `^2.0.0-alpha.1`
   - `@nuxtjs/tailwindcss`: `^6.14.0` → `^7.0.0-beta.0`

2. **Configuration Updates:**
   - Updated `compatibilityDate` to `2024-12-20`
   - All existing configurations remain compatible with Nuxt 4

3. **Node.js Requirement:**
   - **Updated Node.js requirement to `>=22`** (from `>=22` originally)
   - This is required for Nuxt 4 support

### Testing Results:

✅ **Build Process:** Successfully builds with Nuxt 4.0.0  
✅ **Development Server:** Starts correctly with all features working  
✅ **Module Compatibility:** All modules (@nuxt/content, @nuxt/image, @nuxtjs/tailwindcss, @justway/nuxt, @nuxthub/core) work correctly  
✅ **CSS Processing:** TailwindCSS with @apply directives work (some minification warnings are expected)  
✅ **Cloudflare Pages Deployment:** Ready for deployment  

### Known Issues:

- CSS minification warnings with @apply directives - these are warnings only and don't affect functionality
- Some peer dependency warnings are expected during the transition period

### Production Requirements:

**Important:** Make sure your production environment uses Node.js 22 or higher before deploying.