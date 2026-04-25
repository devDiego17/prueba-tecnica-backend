import { Module } from '@nestjs/common'
import { MerchantsModule } from './merchants/merchants.module'
import { TransactionsModule } from './transactions/transactions.module'

@Module({
  imports: [MerchantsModule, TransactionsModule],
})
export class AppModule {}