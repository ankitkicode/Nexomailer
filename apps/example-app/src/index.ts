import { config } from 'dotenv';
import express from 'express';
import { NexoMailer } from '@nexomailer/core';
import { TemplateEngine } from '@nexomailer/templates';

// Load environment variables from .env
config();

async function main() {
  console.log("🚀 Starting NexoMailer Real Project Test...");

  // 1. Initialize NexoMailer
  const mailer = new NexoMailer({
    providers: [
      // Primary: Resend
      { 
        type: 'resend', 
        priority: 1, 
        config: { apiKey: process.env.RESEND_API_KEY || 'test_key' } 
      },
      // Fallback: SMTP
      { 
        type: 'smtp', 
        priority: 2, 
        config: { 
          host: process.env.SMTP_HOST || 'smtp.ethereal.email', 
          port: 587,
          auth: { 
            user: process.env.SMTP_USER || 'test', 
            pass: process.env.SMTP_PASS || 'test' 
          }
        } 
      }
    ],
    failover: { enabled: true, maxRetries: 3, strategy: 'sequential' },
    
    // 100% Private Analytics - Own your data with MongoDB
    analytics: {
      mongodbUri: process.env.MONGODB_URI
    },
    // AI Module (Requires OpenAI Key)
    ai: {
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY || '',
      model: 'gpt-4o'
    },

    // Tracking Module
    tracking: {
      enabled: true,
      baseUrl: 'http://localhost:3010/api', // Points to our local tracking server
      opens: true,
      clicks: true
    },

    queue: {
      redis: {
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
      concurrency: 5
    },
    
    

    // Branding Configuration
    branding: {
      companyName: 'NexoDev Agency',
      websiteUrl: 'https://nexodev.agency',
      footerText: '© 2026 NexoDev Agency. All rights reserved.',
      socialLinks: {
        twitter: 'https://twitter.com/nexodev',
        linkedin: 'https://linkedin.com/company/nexodev'
      },
      tone: 'Friendly, helpful, and tech-savvy'
    },

    defaults: { from: 'hello@nexomailer.dev' },
    projectId: 'nexo-example-app',
    environment: 'production'
  });

  // 2. Load the built-in templates
  console.log("Loading prebuilt templates...");
  const templates = new TemplateEngine();
  await templates.loadBuiltIn();

  // 3. Render the Welcome Template
  const emailContent = await templates.render('otp', {
    code: '849-210',
    expiresIn: 15
  });

  // --- NEW: Test AI Personalization ---
  console.log("Personalizing email with AI...");
  const personalized = await mailer.ai.personalize({
    subject: "Special Offer for you",
    html: '<p>Thanks for being a customer. We have a special discount for your company.</p>',
    recipient: { name: 'Ankit', company: 'Google', plan: 'Enterprise' },
    data: { discountCode: 'NEXO-VIP-2026', validUntil: 'Dec 2026' },
    style: 'Make it sound like a direct 1-on-1 message from a CEO.'
  });

  console.log("AI Personalized Result:", {
    subject: personalized.subject,
    htmlPreview: personalized.html.substring(0, 50) + "..."
  });

  console.log("Attempting to send personalized email with tracking...");

  // 4. Send the Email!
  try {
    const result = await mailer.send({
      to: 'jatavankit486@gmail.com', // Real test email
      subject: personalized.subject || "Your Personalized Message",
      text: personalized.text,
      html: personalized.html,
      tags: ['test-run', 'ceo-outreach']
    });

    console.log("✅ Email sent successfully!");
    console.log("Result:", result);

    // 5. START TRACKING SERVER (Self-Hosted Demo)
    // Instead of a dashboard, we host our own tracking endpoints
    const app = express();
    const port = 3010;

    // Mount the NexoMailer tracking middleware
    app.use('/api', mailer.tracking.middleware());

    app.get('/', (req, res) => {
      res.send('NexoMailer Tracking Server is Running! Open the email to see events in the console.');
    });

    app.listen(port, () => {
      console.log("\n---------------------------------------------------");
      console.log(`🚀 TRACKING SERVER IS LIVE at http://localhost:${port}`);
      console.log(`- Open Tracking: http://localhost:${port}/api/track/open/${result.id}`);
      console.log(`- Click Tracking: http://localhost:${port}/api/track/click/${result.id}?url=https://google.com`);
      console.log("---------------------------------------------------\n");
      console.log("👀 WATCH THIS CONSOLE: Open the email or click the links above to see live DB updates.");
    });

  } catch (error: any) {
    console.error("❌ Error in NexoMailer Test:", error);
  }
}

main().catch(console.error);
