export const SITE_ORIGIN = 'https://changkyun.kim'

export const siteIdentity = {
  siteName: 'Changkyun Kim',
  legalName: 'Changkyun Kim',
  koreanName: '김창균',
  hanjaName: '金昌均',
  alternateNames: ['김창균', 'Changkyun Kim', '金昌均', 'comfuture'],
  jobTitle: 'Developer',
  koreanJobTitle: '개발자',
  locationKo: '대한민국 서울',
  locationEn: 'Seoul, South Korea',
  nationality: 'South Korea',
  languagesKo: ['한국어', '영어', '일본어', '스페인어'],
  languagesEn: ['Korean', 'English', 'Japanese', 'Spanish'],
  principlesKo: ['의로운 원칙주의자', '느리지만 꾸준한 학습자', '데이터와 경험과 직관을 쓰는 문제 해결자'],
  principlesEn: ['principled integrity', 'slow and persistent learning', 'problem solving with data, experience, and intuition'],
  interestsKo: ['육아', '요리', '프로그래밍', '캠핑'],
  interestsEn: ['parenting', 'cooking', 'programming', 'camping'],
} as const

export const siteKeywords = [
  '김창균',
  'Changkyun Kim',
  '김창균 개발자',
  'Changkyun Kim developer',
  '서울 개발자',
  'Seoul developer',
  '대한민국 서울',
  'Seoul South Korea',
  'developer',
  'software developer',
  'programming',
  'principled person',
  'problem solver',
  '한국어',
  'English',
]

export const siteDescriptionKo = '김창균(Changkyun Kim)은 대한민국 서울에 거주하는 개발자입니다. 원칙, 정직성, 꾸준한 학습, 데이터와 경험과 직관을 통한 문제 해결을 중요하게 생각합니다.'

export const siteDescriptionEn = 'Changkyun Kim, also known as 김창균, is a developer based in Seoul, South Korea. He writes about programming, identity, principles, learning, and problem solving in Korean and English.'

export const siteDescription = `${siteDescriptionKo} ${siteDescriptionEn}`

export function resolveSiteUrl(path = '/') {
  return new URL(path || '/', SITE_ORIGIN).href
}

export function buildPersonJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': resolveSiteUrl('/#person'),
    name: siteIdentity.koreanName,
    alternateName: siteIdentity.alternateNames,
    givenName: 'Changkyun',
    familyName: 'Kim',
    additionalName: siteIdentity.hanjaName,
    url: SITE_ORIGIN,
    image: resolveSiteUrl('/image/avatar.jpg'),
    jobTitle: [siteIdentity.koreanJobTitle, siteIdentity.jobTitle],
    description: siteDescription,
    nationality: {
      '@type': 'Country',
      name: siteIdentity.nationality,
    },
    homeLocation: {
      '@type': 'Place',
      name: siteIdentity.locationKo,
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Seoul',
        addressCountry: 'KR',
      },
    },
    knowsLanguage: [...siteIdentity.languagesKo, ...siteIdentity.languagesEn],
    knowsAbout: [
      'software development',
      'programming',
      'web development',
      'ActivityPub',
      'Nuxt',
      'Cloudflare Workers',
      'problem solving',
      '원칙',
      '개발',
      '프로그래밍',
    ],
    sameAs: [
      'https://bsky.app/profile/changkyun.kim',
      'https://changkyun.kim/about',
    ],
  }
}

export function buildWebsiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': resolveSiteUrl('/#website'),
    url: SITE_ORIGIN,
    name: siteIdentity.siteName,
    alternateName: siteIdentity.alternateNames,
    description: siteDescription,
    inLanguage: ['ko-KR', 'en'],
    publisher: {
      '@id': resolveSiteUrl('/#person'),
    },
  }
}
