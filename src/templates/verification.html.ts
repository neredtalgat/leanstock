export function verificationEmailTemplate(firstName: string, verificationLink: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2c3e50; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
          .button { display: inline-block; background: #27ae60; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { background: #ecf0f1; padding: 10px; text-align: center; font-size: 12px; color: #7f8c8d; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to LeanStock!</h1>
          </div>
          <div class="content">
            <p>Hi ${firstName},</p>
            <p>Thank you for registering with LeanStock. To complete your registration and activate your account, please verify your email address by clicking the button below:</p>
            <a href="${verificationLink}" class="button">Verify Email Address</a>
            <p>Or copy this link in your browser:</p>
            <p><small>${verificationLink}</small></p>
            <p>This verification link will expire in 24 hours.</p>
            <p>If you did not create this account, please ignore this email.</p>
          </div>
          <div class="footer">
            <p>&copy; 2026 LeanStock. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}
