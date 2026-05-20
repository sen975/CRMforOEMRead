import { CustomerStage } from "@prisma/client";
import { IsEnum, IsIn, IsOptional, IsString } from "class-validator";

export class DashboardQueryDto {
  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsString()
  ownerId?: string;

  @IsOptional()
  @IsString()
  owner_id?: string;

  @IsOptional()
  @IsString()
  teamId?: string;

  @IsOptional()
  @IsString()
  team_id?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  customerTypeId?: string;

  @IsOptional()
  @IsString()
  customer_type_id?: string;

  @IsOptional()
  @IsEnum(CustomerStage)
  stage?: CustomerStage;

  @IsOptional()
  @IsIn(["day", "week", "month"])
  groupBy?: "day" | "week" | "month";

  @IsOptional()
  @IsIn(["day", "week", "month"])
  group_by?: "day" | "week" | "month";
}

