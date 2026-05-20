import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { WebsiteAnalysisController } from "./website-analysis.controller";
import { WebsiteAnalysisService } from "./website-analysis.service";
import { WebsiteCrawlerService } from "./website-crawler.service";
import { WebsiteAnalysisProcessor } from "./website-analysis.processor";
import { WEBSITE_ANALYSIS_QUEUE } from "./website-analysis.constants";

@Module({
  imports: [AiModule, BullModule.registerQueue({ name: WEBSITE_ANALYSIS_QUEUE })],
  controllers: [WebsiteAnalysisController],
  providers: [WebsiteAnalysisService, WebsiteCrawlerService, WebsiteAnalysisProcessor],
  exports: [WebsiteAnalysisService]
})
export class WebsiteAnalysisModule {}
