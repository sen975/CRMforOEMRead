import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { CurrentUser, RequestUser } from "../../common/auth/current-user.decorator";
import { AddAiContentVersionDto } from "./dto/add-ai-content-version.dto";
import { AiGenerationService } from "./ai-generation.service";

@Controller("ai-generation-runs")
export class AiController {
  constructor(private readonly aiGenerationService: AiGenerationService) {}

  @Get(":id")
  get(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.aiGenerationService.getRun(user, id);
  }

  @Get(":id/versions")
  versions(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.aiGenerationService.listVersions(user, id);
  }

  @Post(":id/versions")
  addVersion(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: AddAiContentVersionDto) {
    return this.aiGenerationService.addVersion(user, id, dto);
  }

  @Post(":id/finalize")
  finalize(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: AddAiContentVersionDto) {
    return this.aiGenerationService.finalize(user, id, dto);
  }
}

