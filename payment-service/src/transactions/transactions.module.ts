import { Module } from '@nestjs/common'
import { TransactionsController } from './transactions.controller'
import { TransactionsService } from './transactions.service'
import { PrismaService } from '../prisma/prisma.service'
import { ApiKeyGuard } from '../common/guards/api-key.guard'

@Module({
  controllers: [TransactionsController],
  providers: [TransactionsService, PrismaService, ApiKeyGuard],
})
export class TransactionsModule {}