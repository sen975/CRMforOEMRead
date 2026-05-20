import { IsOptional, IsString } from "class-validator";

export class AssignCustomerDto {
  @IsString()
  ownerId!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

