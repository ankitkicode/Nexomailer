# Contributing to NexoMailer

First off, thank you for considering contributing to NexoMailer! It's people like you that make the open-source community such an amazing place to learn, inspire, and create.

## 🚀 How Can I Contribute?

### Reporting Bugs
- Use the [GitHub Issues](https://github.com/ankitkicode/Nexomailer/issues) tab.
- Describe the bug and provide steps to reproduce it.
- Include your environment details (Node.js version, OS).

### Suggesting Enhancements
- Open an issue with the tag `enhancement`.
- Explain why this feature would be useful to most NexoMailer users.

### Pull Requests
1. Fork the repo and create your branch from `main`.
2. If you've added code that should be tested, add tests.
3. Ensure the test suite passes (`pnpm test`).
4. Format your code (`pnpm format`).
5. Open a Pull Request with a clear description of the changes.

## 💻 Local Development Setup

NexoMailer is a monorepo powered by **TurboRepo** and **pnpm**.

1. **Clone the repo**:
   ```bash
   git clone https://github.com/ankitkicode/Nexomailer.git
   cd Nexomailer
   ```

2. **Install Dependencies**:
   ```bash
   pnpm install
   ```

3. **Build All Packages**:
   ```bash
   pnpm build
   ```

4. **Run Docs Locally**:
   ```bash
   pnpm dev --filter @nexomailer/docs
   ```

## 📜 Code of Conduct
Please be respectful and professional in all interactions within the project.

---
Thank you for your support!
