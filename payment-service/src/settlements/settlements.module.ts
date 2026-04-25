import { Module } from '@nestjs/common'
import { SettlementsController } from './settlements.controller'
import { SettlementsService } from './settlements.service'
import { PrismaService } from '../prisma/prisma.service'

@Module({
  controllers: [SettlementsController],
  providers: [SettlementsService, PrismaService],
})
export class SettlementsModule {}