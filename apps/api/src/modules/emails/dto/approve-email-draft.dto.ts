import { IsOptional, IsString } from "class-validator";

export class ApproveEmailDraftDto {
  @IsOptional()
  @IsString()
  reviewComment?: string;
}

