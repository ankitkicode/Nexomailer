<div align="center">
  <img src="apps/docs/public/logo.png" width="160" alt="NexoMailer Logo" />
  <h1>NexoMailer</h1>
  <p><b>AI-powered email infrastructure SDK</b></p>
</div>

NexoMailer is a professional Node.js framework for developers who need complete control over their email delivery. It combines multi-provider failover, AI-driven personalization, and private analytics into a single, cohesive, headless SDK.

## Key Capabilities
- **Smart Failover Engine**: Automatically route failed sends across providers (SMTP, Resend, AWS SES).
- **AI-Powered Personalization**: Native OpenAI/OpenRouter integration for subject optimization and dynamic content.
- **Enterprise Queue**: Redis-backed scheduling and rate-limiting using BullMQ.
- **Private Analytics**: Own your data with a built-in MongoDB persistence layer.
- **Tracking & Webhooks**: Headless open/click tracking with a pluggable webhook system.

## Project Structure
NexoMailer is a modular monorepo built with TurboRepo:

- **[@nexomailer/core](./packages/core)**: The main SDK orchestrator.
- **[@nexomailer/smtp](./packages/smtp)**: Native high-performance SMTP client.
- **[@nexomailer/providers](./packages/providers)**: Multi-provider registry and failover logic.
- **[@nexomailer/ai](./packages/ai)**: LLM integration suite.
- **[@nexomailer/analytics](./packages/analytics)**: MongoDB persistence and reporting.
- **[@nexomailer/tracking](./packages/tracking)**: Engagement tracking and webhook handlers.
- **[@nexomailer/templates](./packages/templates)**: MJML & Handlebars engine.
- **[@nexomailer/queue](./packages/queue)**: Background processing and scheduling.

## Documentation
The complete documentation is available at `apps/docs`. To run it locally:
```bash
pnpm dev --filter docs
```

## Quick Start
1. **Install**: `pnpm install`
2. **Build**: `pnpm build`
3. **Test**: `pnpm test`

---
© 2026 NexoMailer - Premium SDK Solutions.
