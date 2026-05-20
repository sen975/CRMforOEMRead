import { FollowUpTaskStatus } from "@oem-crm/shared";
import { IsDateString, IsEnum, IsOptional, IsString } from "class-validator";

export class UpdateFollowUpTaskDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  dueAt?: string;

  @IsOptional()
  @IsEnum(FollowUpTaskStatus)
  status?: FollowUpTaskStatus;
}

