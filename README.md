<div align="center">
  <img src="apps/docs/public/logo.png" width="160" alt="NexoMailer Logo" />
  <h1>NexoMailer</h1>
  <p><b>AI-powered email infrastructure SDK for Node.js</b></p>
  <p>
    <a href="https://docs.nexomailer.com">Documentation</a> •
    <a href="https://www.npmjs.com/org/nexomailer">NPM Registry</a> •
    <a href="https://github.com/ankitkicode/Nexomailer/issues">Report Bug</a>
  </p>
</div>

---

NexoMailer is a professional, headless Node.js framework designed for developers who need complete control over their email delivery. It combines multi-provider failover, AI-driven personalization, and private analytics into a single, cohesive SDK.

## 🚀 Key Features
- **Smart Failover**: Automatic routing across SMTP, Resend, and AWS SES.
- **AI Personalization**: Dynamic subject and content optimization via OpenAI/OpenRouter.
- **Private Analytics**: 100% data ownership with built-in MongoDB persistence.
- **Engagement Tracking**: Headless open/click tracking with pluggable webhooks.
- **Enterprise Queue**: High-throughput scheduling with BullMQ & Redis.

## 📦 Installation

Install the core engine and necessary modules:

```bash
pnpm add @nexomailer/core @nexomailer/providers @nexomailer/analytics
```

## 🛠️ Quick Start

```typescript
import { NexoMailer } from '@nexomailer/core';

const mailer = new NexoMailer({
  providers: [{
    type: 'smtp',
    priority: 1,
    config: { host: 'smtp.gmail.com', port: 587, auth: { ... } }
  }],
  analytics: { mongodbUri: 'mongodb://localhost:27017/nexomailer' }
});

await mailer.send({
  to: 'user@example.com',
  subject: 'Welcome to the Future',
  html: '<h1>Hello World</h1>',
  tracking: true
});
```

## 📖 Documentation
Visit [docs.nexomailer.com](https://docs.nexomailer.com) for full API reference, integration guides, and advanced configuration.

## 🤝 Contributing
Contributions are welcome! See our [Contributing Guide](./CONTRIBUTING.md).

## ⚠️ Disclaimer
NexoMailer is provided "as is". The author (Ankit Jatav) is not responsible for any data loss or legal issues. Use at your own risk.

## 📜 License
Licensed under the [MIT License](./LICENSE).

---
© 2026 Ankit Jatav - Premium SDK Solutions.
