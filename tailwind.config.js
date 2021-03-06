/*
** TailwindCSS Configuration File
**
** Docs: https://tailwindcss.com/docs/configuration
** Default: https://github.com/tailwindcss/tailwindcss/blob/master/stubs/defaultConfig.stub.js
*/
module.exports = {
  theme: {},
  variants: {},
  plugins: [
    require('@tailwindcss/typography')
  ],
  mode: 'jit',
  purge: {
    // Learn more on https://tailwindcss.com/docs/controlling-file-size/#removing-unused-css
    mode: 'all',
    enabled: process.env.NODE_ENV === 'production',
    content: [
      'components/**/*.vue',
      'layouts/**/*.vue',
      'pages/**/*.vue',
      'content/**/*.md',
      'plugins/**/*.js',
      'nuxt.config.js'
    ],
    whitelistPatterns: [/token/, /^pre/, /^code/],
    whitelistPatternsChildren: [/token/, /^pre/, /^code/, /nuxt-content-highlight/]
  }
}
