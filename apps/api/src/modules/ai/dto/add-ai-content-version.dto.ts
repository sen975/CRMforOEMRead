import { AiContentVersionType } from "@oem-crm/shared";
import { IsEnum, IsObject, IsOptional, IsString } from "class-validator";

export class AddAiContentVersionDto {
  @IsOptional()
  @IsEnum(AiContentVersionType)
  versionType?: AiContentVersionType;

  @IsString()
  content!: string;

  @IsOptional()
  @IsObject()
  contentJson?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  editReason?: string;
}

