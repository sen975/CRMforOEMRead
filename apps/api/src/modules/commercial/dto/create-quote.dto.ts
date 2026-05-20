import { IsDateString, IsNumber, IsOptional, IsString } from "class-validator";

export class CreateQuoteDto {
  @IsString()
  customerId!: string;

  @IsString()
  quoteNo!: string;

  @IsString()
  currency!: string;

  @IsNumber()
  amount!: number;

  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @IsOptional()
  @IsString()
  fileAssetId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

