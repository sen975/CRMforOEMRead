import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { CurrentUser, RequestUser } from "../../common/auth/current-user.decorator";
import { CommercialService } from "./commercial.service";
import { CreateQuoteDto } from "./dto/create-quote.dto";
import { CreateSampleRequestDto } from "./dto/create-sample-request.dto";

@Controller()
export class CommercialController {
  constructor(private readonly commercialService: CommercialService) {}

  @Get("quotes")
  quotes(@CurrentUser() user: RequestUser, @Query("customerId") customerId?: string) {
    return this.commercialService.listQuotes(user, customerId);
  }

  @Post("quotes")
  createQuote(@CurrentUser() user: RequestUser, @Body() dto: CreateQuoteDto) {
    return this.commercialService.createQuote(user, dto);
  }

  @Get("samples")
  samples(@CurrentUser() user: RequestUser, @Query("customerId") customerId?: string) {
    return this.commercialService.listSamples(user, customerId);
  }

  @Post("samples")
  createSample(@CurrentUser() user: RequestUser, @Body() dto: CreateSampleRequestDto) {
    return this.commercialService.createSample(user, dto);
  }
}

