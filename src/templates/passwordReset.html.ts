export function passwordResetEmailTemplate(firstName: string, resetLink: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #e74c3c; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
          .button { display: inline-block; background: #3498db; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { background: #ecf0f1; padding: 10px; text-align: center; font-size: 12px; color: #7f8c8d; }
          .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Request</h1>
          </div>
          <div class="content">
            <p>Hi ${firstName},</p>
            <p>We received a request to reset your LeanStock password. Click the button below to set a new password:</p>
            <a href="${resetLink}" class="button">Reset Password</a>
            <p>Or copy this link in your browser:</p>
            <p><small>${resetLink}</small></p>
            <div class="warning">
              <strong>⚠️ Important:</strong> This link will expire in 1 hour for security reasons.
            </div>
            <p>If you did not request a password reset, please ignore this email or contact support if you believe this is a mistake.</p>
          </div>
          <div class="footer">
            <p>&copy; 2026 LeanStock. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}
