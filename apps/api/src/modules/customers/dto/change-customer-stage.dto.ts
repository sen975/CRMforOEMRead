import { CustomerStage } from "@oem-crm/shared";
import { IsEnum, IsOptional, IsString } from "class-validator";

export class ChangeCustomerStageDto {
  @IsEnum(CustomerStage)
  stage!: CustomerStage;

  @IsOptional()
  @IsString()
  reason?: string;
}

