import { IsDateString, IsOptional, IsString } from "class-validator";

export class CreateFollowUpTaskDto {
  @IsString()
  customerId!: string;

  @IsOptional()
  @IsString()
  ownerId?: string;

  @IsString()
  type!: string;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  trigger?: string;

  @IsDateString()
  dueAt!: string;
}

