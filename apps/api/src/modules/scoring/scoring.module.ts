import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { ScoringController } from "./scoring.controller";
import { ScoringService } from "./scoring.service";

@Module({
  imports: [AiModule],
  controllers: [ScoringController],
  providers: [ScoringService],
  exports: [ScoringService]
})
export class ScoringModule {}

