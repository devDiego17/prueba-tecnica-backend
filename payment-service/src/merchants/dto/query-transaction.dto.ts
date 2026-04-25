import { IsEnum, IsISO8601, IsOptional, IsInt, Min, Max } from 'class-validator'
import { Type } from 'class-transformer'
import { TransactionStatus, TransactionType } from '@prisma/client'

export class QueryTransactionDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 20

  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus

  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType

  @IsOptional()
  @IsISO8601()
  date_from?: string

  @IsOptional()
  @IsISO8601()
  date_to?: string
}