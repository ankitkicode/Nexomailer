export const welcomeTemplate = {
  subject: "Welcome to {{companyName}}, {{name}}!",
  isMjml: true,
  html: `
<mjml>
  <mj-head>
    <mj-attributes>
      <mj-all font-family="'Inter', Helvetica, Arial, sans-serif" />
      <mj-text font-size="16px" color="#444444" line-height="24px" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#ffffff">
    <mj-section padding-top="50px">
      <mj-column>
        <mj-text font-size="24px" font-weight="bold" color="#111111" align="center">
          {{companyName}}
        </mj-text>
        <mj-divider border-width="1px" border-color="#eeeeee" padding-top="20px" />
      </mj-column>
    </mj-section>
    
    <mj-section padding="20px">
      <mj-column>
        <mj-text font-size="20px" font-weight="600" color="#111111">
          Welcome aboard, {{name}}! 👋
        </mj-text>
        <mj-text>
          We're excited to have you with us. Your account is now active and ready to use.
        </mj-text>
        <mj-button background-color="#111111" color="#ffffff" border-radius="4px" href="{{actionUrl}}" font-weight="600" padding-top="20px">
          Start Exploring
        </mj-button>
      </mj-column>
    </mj-section>
    
    <mj-section>
      <mj-column>
        <mj-text align="center" font-size="12px" color="#888888" padding-top="40px">
          © {{companyName}}. All rights reserved.
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>
`};

export const otpTemplate = {
  subject: "{{code}} is your verification code",
  isMjml: true,
  html: `
<mjml>
  <mj-head>
    <mj-attributes>
      <mj-all font-family="'Inter', Helvetica, Arial, sans-serif" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#f9f9f9">
    <mj-section padding-top="60px">
      <mj-column background-color="#ffffff" padding="40px" border-radius="8px">
        <mj-text align="center" font-size="20px" font-weight="bold" color="#111111">
          Security Code
        </mj-text>
        <mj-text align="center" color="#666666" padding-top="10px">
          Use the code below to verify your action. It will expire in {{expiresIn}} minutes.
        </mj-text>
        
        <mj-text align="center" font-size="36px" font-weight="bold" color="#111111" letter-spacing="5px" padding="30px 0">
          {{code}}
        </mj-text>
        
        <mj-text align="center" font-size="13px" color="#999999">
          If you didn't request this, you can ignore this email.
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>
`};

export const resetPasswordTemplate = {
  subject: "Reset your password",
  isMjml: true,
  html: `
<mjml>
  <mj-head>
    <mj-attributes>
      <mj-all font-family="'Inter', Helvetica, Arial, sans-serif" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#ffffff">
    <mj-section padding-top="50px">
      <mj-column>
        <mj-text font-size="24px" font-weight="bold" color="#111111">
          Reset Password
        </mj-text>
        <mj-text padding-top="10px">
          Hi {{name}}, we received a request to reset your password. Click the button below to choose a new one.
        </mj-text>
        <mj-button background-color="#111111" color="#ffffff" border-radius="4px" href="{{resetUrl}}" font-weight="600" padding-top="30px" align="left">
          Reset Password
        </mj-button>
        <mj-text font-size="13px" color="#999999" padding-top="40px">
          Link expires in 1 hour. If you didn't request this, no action is needed.
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>
`};

export const prebuiltTemplates = {
  welcome: welcomeTemplate,
  otp: otpTemplate,
  'reset-password': resetPasswordTemplate
};
