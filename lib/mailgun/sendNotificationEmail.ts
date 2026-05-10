import FormData from 'form-data';
import Mailgun from 'mailgun.js';
import { logError } from "@/lib/sentry/logger";


export type EmailTemplateType = 
  | 'gg_universal_notification' // Used for player rewards/welcome
  | 'gg_admin_invite';          // Used for inviting new club admins

interface NotificationParams {
  email: string;
  template: EmailTemplateType;
  subject: string;
  // This maps directly to the Handlebars {{variables}} in your Mailgun templates
  variables: {
    headline?: string;
    body_text?: string;
    button_text?: string;
    action_url?: string;
    reward_list?: string;
    name?: string;
    client_name?: string;
    [key: string]: any; // Allows flexibility for any future templates you build
  };
}

export async function sendNotificationEmail({ 
  email, 
  template, 
  subject, 
  variables 
}: NotificationParams) {
  const domain = process.env.MAILGUN_DOMAIN;
  const fromEmail = process.env.MAILGUN_FROM_EMAIL;

  const mailgun = new Mailgun(FormData);
  const mg = mailgun.client({
    username: 'api',
    key: process.env.MAILGUN_API_KEY || '',
  });

  if (!domain || !fromEmail) {
    console.error("Missing Mailgun configuration (MAILGUN_DOMAIN or MAILGUN_FROM_EMAIL).");
    return;
  }

  try {
    console.log(
      `[Email Service] Sending '${template}' to: ${email}`,
      `\nSubject: ${subject}`,
      `\nVariables:`, variables,
      `\nTemplate:`, template
    );

    /*
    await mg.messages.create(domain, {
      from: fromEmail,
      to: [email],
      subject: subject,
      template: template,
      'h:X-Mailgun-Variables': JSON.stringify(variables),
    });
    */

  } catch (error: unknown) {
    logError(error, { message: `Failed to send ${template} email to ${email}` });
    if (error instanceof Error) {
        console.error(`Mailgun Error: ${error.message}`);
    } else {
        console.error("Unknown Mailgun Error", error);
    }
  }
}