import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const siteName = 'Free Everything PDF'
const siteUrl = 'https://free-everything-pdf.prabhu-tools.com'
const defaultImage = `${siteUrl}/og-image.png`

interface SeoConfig {
  title: string
  description: string
  canonical: string
  robots: string
  ogType?: 'website' | 'article'
  schema?: Record<string, unknown> | Array<Record<string, unknown>>
}

function upsertMeta(attribute: 'name' | 'property', value: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${value}"]`)
  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attribute, value)
    document.head.appendChild(element)
  }
  element.setAttribute('content', content)
}

function upsertLink(rel: string, href: string) {
  let element = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
  if (!element) {
    element = document.createElement('link')
    element.setAttribute('rel', rel)
    document.head.appendChild(element)
  }
  element.setAttribute('href', href)
}

function getSeoConfig(pathname: string, search: string): SeoConfig {
  if (pathname === '/tools') {
    const params = new URLSearchParams(search)
    const tool = params.get('tool')

    if (tool) {
      return {
        title: `${formatToolName(tool)} | ${siteName}`,
        description: `Use the ${formatToolName(tool)} tool in ${siteName} to work with PDFs directly in your browser without uploading files.`,
        canonical: `${siteUrl}/tools`,
        robots: 'index,follow',
        schema: {
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: `${siteName} ${formatToolName(tool)}`,
          applicationCategory: 'BusinessApplication',
          operatingSystem: 'Web',
          offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'USD'
          },
          url: `${siteUrl}/tools?tool=${tool}`
        }
      }
    }

    return {
      title: `PDF Tools Atlas | ${siteName}`,
      description: `${siteName} includes browser-based tools for merging, splitting, OCR, conversion, cropping, layout work, metadata editing, and PDF review.`,
      canonical: `${siteUrl}/tools`,
      robots: 'index,follow',
      schema: {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: `${siteName} PDF Tools Atlas`,
        url: `${siteUrl}/tools`,
        description: `${siteName} includes browser-based tools for merging, splitting, OCR, conversion, cropping, layout work, metadata editing, and PDF review.`
      }
    }
  }

  if (pathname === '/help') {
    return {
      title: `Help & Guide | ${siteName}`,
      description: `Learn how to use ${siteName} for PDF viewing, editing, OCR, conversion, and layout work while keeping files local to your browser.`,
      canonical: `${siteUrl}/help`,
      robots: 'index,follow',
      schema: {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: `${siteName} Help`,
        url: `${siteUrl}/help`,
        description: `Learn how to use ${siteName} for PDF viewing, editing, OCR, conversion, and layout work while keeping files local to your browser.`
      }
    }
  }

  if (pathname === '/editor') {
    return {
      title: `PDF Editor | ${siteName}`,
      description: `Open and work on PDFs in the ${siteName} editor with local browser-side processing.`,
      canonical: `${siteUrl}/editor`,
      robots: 'noindex,follow',
      schema: {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: `${siteName} Editor`,
        url: `${siteUrl}/editor`,
        description: `Open and work on PDFs in the ${siteName} editor with local browser-side processing.`
      }
    }
  }

  return {
    title: `${siteName} | Free Online PDF Tools That Run in Your Browser`,
    description: `${siteName} is a privacy-first PDF studio for merging, splitting, OCR, converting, editing, and organizing PDFs directly in your browser with no uploads.`,
    canonical: `${siteUrl}/`,
    robots: 'index,follow',
    schema: [
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: siteName,
        url: siteUrl,
        description: `${siteName} is a privacy-first PDF studio for merging, splitting, OCR, converting, editing, and organizing PDFs directly in your browser with no uploads.`
      },
      {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: siteName,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD'
        },
        url: siteUrl,
        image: defaultImage,
        description: `${siteName} is a privacy-first PDF studio for merging, splitting, OCR, converting, editing, and organizing PDFs directly in your browser with no uploads.`
      }
    ]
  }
}

function formatToolName(value: string) {
  return value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function SEO() {
  const location = useLocation()

  useEffect(() => {
    const config = getSeoConfig(location.pathname, location.search)
    const url = `${siteUrl}${location.pathname}${location.search}`

    document.title = config.title
    upsertLink('canonical', config.canonical)

    upsertMeta('name', 'description', config.description)
    upsertMeta('name', 'robots', config.robots)
    upsertMeta('name', 'application-name', siteName)
    upsertMeta('name', 'apple-mobile-web-app-title', siteName)
    upsertMeta('property', 'og:type', config.ogType || 'website')
    upsertMeta('property', 'og:site_name', siteName)
    upsertMeta('property', 'og:title', config.title)
    upsertMeta('property', 'og:description', config.description)
    upsertMeta('property', 'og:url', config.canonical)
    upsertMeta('property', 'og:image', defaultImage)
    upsertMeta('property', 'og:image:alt', `${siteName} logo and brand card`)
    upsertMeta('name', 'twitter:card', 'summary_large_image')
    upsertMeta('name', 'twitter:title', config.title)
    upsertMeta('name', 'twitter:description', config.description)
    upsertMeta('name', 'twitter:image', defaultImage)
    upsertMeta('name', 'twitter:url', url)

    const existing = document.getElementById('route-seo-schema')
    if (existing) {
      existing.remove()
    }

    if (config.schema) {
      const script = document.createElement('script')
      script.id = 'route-seo-schema'
      script.type = 'application/ld+json'
      script.text = JSON.stringify(config.schema)
      document.head.appendChild(script)
    }
  }, [location.pathname, location.search])

  return null
}
