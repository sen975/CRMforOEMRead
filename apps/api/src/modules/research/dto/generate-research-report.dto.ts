import { IsOptional, IsString } from "class-validator";

export class GenerateResearchReportDto {
  @IsOptional()
  @IsString()
  salesNotes?: string;
}

