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
      titleTemplate: '%s – NexoMailer'
    }
  },
  head: (
    <>
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <link rel="icon" type="image/png" href="/logo.png" />
    </>
  ),
  footer: {
    text: `© ${new Date().getFullYear()} NexoMailer - AI-powered email infrastructure SDK.`
  }
}
