import { Controller, Get, Param, Post } from "@nestjs/common";
import { CurrentUser, RequestUser } from "../../common/auth/current-user.decorator";
import { ScoringService } from "./scoring.service";

@Controller("customers/:customerId/oem-fit-scores")
export class ScoringController {
  constructor(private readonly scoringService: ScoringService) {}

  @Post()
  generate(@CurrentUser() user: RequestUser, @Param("customerId") customerId: string) {
    return this.scoringService.generate(user, customerId);
  }

  @Get("latest")
  latest(@CurrentUser() user: RequestUser, @Param("customerId") customerId: string) {
    return this.scoringService.getLatest(user, customerId);
  }
}

