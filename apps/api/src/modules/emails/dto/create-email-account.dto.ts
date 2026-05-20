import { IsBoolean, IsEmail, IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class CreateEmailAccountDto {
  @IsString()
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  smtpHost!: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  smtpPort!: number;

  @IsOptional()
  @IsBoolean()
  smtpSecure?: boolean;

  @IsOptional()
  @IsIn(["PERSONAL", "SHARED"])
  scope?: "PERSONAL" | "SHARED";

  @IsString()
  smtpUsername!: string;

  @IsString()
  smtpPassword!: string;

  @IsString()
  imapHost!: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  imapPort!: number;

  @IsOptional()
  @IsBoolean()
  imapSecure?: boolean;

  @IsString()
  imapUsername!: string;

  @IsString()
  imapPassword!: string;

  @IsOptional()
  @IsInt()
  dailySendLimit?: number;

  @IsOptional()
  @IsInt()
  hourlySendLimit?: number;
}
