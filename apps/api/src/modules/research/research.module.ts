import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { RESEARCH_REPORT_QUEUE } from "./research.constants";
import { ResearchController } from "./research.controller";
import { ResearchProcessor } from "./research.processor";
import { ResearchService } from "./research.service";
import { SearchProviderService } from "./search-provider.service";

@Module({
  imports: [AiModule, BullModule.registerQueue({ name: RESEARCH_REPORT_QUEUE })],
  controllers: [ResearchController],
  providers: [ResearchService, ResearchProcessor, SearchProviderService],
  exports: [ResearchService]
})
export class ResearchModule {}
