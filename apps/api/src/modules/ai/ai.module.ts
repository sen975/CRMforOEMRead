import { Module } from "@nestjs/common";
import { AiController } from "./ai.controller";
import { AiGenerationService } from "./ai-generation.service";
import { AiProviderService } from "./ai-provider.service";

@Module({
  controllers: [AiController],
  providers: [AiGenerationService, AiProviderService],
  exports: [AiGenerationService, AiProviderService]
})
export class AiModule {}

