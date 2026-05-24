import React from 'react'

export default {
  logo: (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <img src="/logo.png" alt="NexoMailer Logo" style={{ width: '32px', height: '32px', borderRadius: '4px' }} />
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontWeight: 800, fontSize: '1.1rem', letterSpacing: '-0.02em' }}>NexoMailer</span>
        <span style={{ fontSize: '0.7rem', opacity: 0.6, marginTop: '-4px', fontWeight: 500 }}>AI Email SDK</span>
      </div>
    </div>
  ),
  project: {
    link: 'https://github.com/ankitkicode/Nexomailer'
  },
  docsRepositoryBase: 'https://github.com/ankitkicode/Nexomailer/tree/main/apps/docs',
  useNextSeoProps() {
    return {
      titleTemplate: '%s – NexoMailer SDK',
      description: 'Official documentation for NexoMailer - AI-powered email infrastructure SDK'
    }
  },
  head: (
    <>
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <link rel="icon" type="image/png" href="/logo.png" />

      {/* SEO / Google Search Console verification (set NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION) */}
      {process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ? (
        <meta name="google-site-verification" content={process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION} />
      ) : null}

      {/* Canonical (set NEXT_PUBLIC_SITE_URL) - fallback to Vercel docs URL */}
      <link rel="canonical" href={process.env.NEXT_PUBLIC_SITE_URL || 'https://nexomailer-docs.vercel.app/'} />

      {/* Basic Open Graph defaults */}
      <meta property="og:site_name" content="NexoMailer" />
      <meta property="og:type" content="website" />
      <meta property="og:locale" content="en_US" />

      {/* Structured data (Organization) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: 'NexoMailer',
            url: process.env.NEXT_PUBLIC_SITE_URL || 'https://nexomailer-docs.vercel.app/',
            logo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://nexomailer-docs.vercel.app'}/logo.png`,
            sameAs: ['https://github.com/ankitkicode/Nexomailer']
          })
        }}
      />

      {/* Google Analytics (GA4) - set NEXT_PUBLIC_GA_MEASUREMENT_ID */}
      {process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ? (
        <>
          <script async src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}`} />
          <script
            dangerouslySetInnerHTML={{
              __html: `window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date()); gtag('config', '${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}', { send_page_view: true });`
            }}
          />
        </>
      ) : null}
    </>
  ),
  footer: {
    text: `© ${new Date().getFullYear()} NexoMailer - AI-powered email infrastructure SDK. Docs: https://nexomailer-docs.vercel.app/`
  }
}
