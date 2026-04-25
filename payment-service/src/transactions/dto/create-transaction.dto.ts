import { IsEnum, IsNotEmpty, IsNumber, IsObject, IsOptional, IsPositive, IsUUID } from 'class-validator'
import { Currency, TransactionType } from '@prisma/client'

export class CreateTransactionDto {
  @IsUUID('4')
  @IsOptional()
  merchant_id?: string

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount: number

  @IsEnum(Currency)
  currency: Currency

  @IsEnum(TransactionType)
  type: TransactionType

  @IsObject()
  @IsOptional()
  metadata?: object
}