import { Module } from '@nestjs/common'
import { MerchantsModule } from './merchants/merchants.module'
import { TransactionsModule } from './transactions/transactions.module'
import { SettlementsModule } from './settlements/settlements.module'

@Module({
  imports: [MerchantsModule, TransactionsModule, SettlementsModule],
})
export class AppModule {}