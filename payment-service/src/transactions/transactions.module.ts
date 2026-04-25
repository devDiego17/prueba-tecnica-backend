import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { TransactionsController } from './transactions.controller'
import { TransactionsService } from './transactions.service'
import { ApiKeyGuard } from '../common/guards/api-key.guard'

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'transactions',
    }),
  ],
  controllers: [TransactionsController],
  providers: [TransactionsService, ApiKeyGuard],
})
export class TransactionsModule { }