const DOMAIN = 'changkyun.kim'

const HOST_META_RESPONSE = `<?xml version="1.0" encoding="UTF-8"?>
<XRD xmlns="http://docs.oasis-open.org/ns/xri/xrd-1.0">
  <Link rel="lrdd" type="application/xrd+xml" template="https://${DOMAIN}/.well-known/webfinger?resource={uri}" />
  <Link rel="lrdd" type="application/jrd+json" template="https://${DOMAIN}/.well-known/webfinger?resource={uri}" />
</XRD>`

export default defineEventHandler((event) => {
  setResponseHeader(event, 'Content-Type', 'application/xrd+xml; charset=utf-8')
  return HOST_META_RESPONSE
})
