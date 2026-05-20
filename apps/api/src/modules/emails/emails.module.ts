import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { EmailsController } from "./emails.controller";
import { EmailComplianceService } from "./email-compliance.service";
import { EmailSecretService } from "./email-secret.service";
import { EmailsService } from "./emails.service";
import { ImapSyncService } from "./imap-sync.service";
import { SmtpService } from "./smtp.service";

@Module({
  imports: [AiModule],
  controllers: [EmailsController],
  providers: [EmailsService, EmailComplianceService, EmailSecretService, SmtpService, ImapSyncService],
  exports: [EmailsService]
})
export class EmailsModule {}

