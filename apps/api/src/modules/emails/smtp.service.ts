import { Injectable } from "@nestjs/common";
import nodemailer from "nodemailer";
import { EmailSecretService } from "./email-secret.service";

@Injectable()
export class SmtpService {
  constructor(private readonly secrets: EmailSecretService) {}

  async verify(account: SmtpAccount) {
    const transport = this.createTransport(account);
    await transport.verify();
  }

  async send(account: SmtpAccount, draft: { subject: string; body: string; toEmail: string; ccEmails: string[]; bccEmails: string[] }) {
    const transport = this.createTransport(account);
    const result = await transport.sendMail({
      from: account.email,
      to: draft.toEmail,
      cc: draft.ccEmails,
      bcc: draft.bccEmails,
      subject: draft.subject,
      text: draft.body
    });
    return { messageId: result.messageId };
  }

  private createTransport(account: SmtpAccount) {
    return nodemailer.createTransport({
      host: account.smtpHost,
      port: account.smtpPort,
      secure: account.smtpSecure,
      auth: {
        user: account.smtpUsername,
        pass: this.secrets.decrypt(account.smtpPasswordEncrypted)
      }
    });
  }
}

type SmtpAccount = {
  email: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUsername: string;
  smtpPasswordEncrypted: string;
};

