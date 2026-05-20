import { IsArray, IsEmail, IsOptional, IsString } from "class-validator";

export class UpdateEmailDraftDto {
  @IsOptional()
  @IsString()
  emailAccountId?: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsEmail()
  toEmail?: string;

  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  ccEmails?: string[];

  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  bccEmails?: string[];
}

