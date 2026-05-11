export function businessEventEmailTemplate(
  firstName: string,
  eventType: string,
  title: string,
  message: string,
  details: Record<string, any>
): string {
  let contentHtml = '';

  // Add details table if provided
  if (details && Object.keys(details).length > 0) {
    contentHtml += '<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">';
    contentHtml += '<tr style="background: #ecf0f1;"><th style="padding: 10px; text-align: left; border: 1px solid #bdc3c7;"><strong>Field</strong></th><th style="padding: 10px; text-align: left; border: 1px solid #bdc3c7;"><strong>Value</strong></th></tr>';

    Object.entries(details).forEach(([key, value]) => {
      contentHtml += `<tr><td style="padding: 10px; border: 1px solid #bdc3c7;"><strong>${key}</strong></td><td style="padding: 10px; border: 1px solid #bdc3c7;">${value}</td></tr>`;
    });

    contentHtml += '</table>';
  }

  const headerBg = eventType === 'success' ? '#27ae60' : eventType === 'warning' ? '#f39c12' : '#e74c3c';

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: ${headerBg}; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
          .footer { background: #ecf0f1; padding: 10px; text-align: center; font-size: 12px; color: #7f8c8d; }
          table { border: 1px solid #ddd; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${title}</h1>
          </div>
          <div class="content">
            <p>Hi ${firstName},</p>
            <p>${message}</p>
            ${contentHtml}
            <p>For more details, please log in to your LeanStock dashboard.</p>
          </div>
          <div class="footer">
            <p>&copy; 2026 LeanStock. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}
