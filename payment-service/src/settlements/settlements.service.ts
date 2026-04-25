import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { Prisma } from '@prisma/client'
import { CreateSettlementDto } from './dto/create-settlements.dto'

@Injectable()
export class SettlementsService {
  constructor(private prisma: PrismaService) {}

  async generate(dto: CreateSettlementDto) {
    const { merchant_id, period_start, period_end } = dto

    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchant_id },
    })

    if (!merchant) {
      throw new NotFoundException(`Merchant con id ${merchant_id} no existe`)
    }

    const transactions = await this.prisma.transaction.findMany({
      where: {
        merchantId: merchant_id,
        status: 'approved',
        createdAt: {
          gte: new Date(period_start),
          lte: new Date(period_end),
        },
        settlementTransactions: { none: {} },
      },
    })

    if (transactions.length === 0) {
      throw new NotFoundException('No hay transacciones elegibles en el periodo indicado')
    }

    const totalAmount = transactions.reduce(
      (sum, tx) => sum.add(tx.amount),
      new Prisma.Decimal(0),
    )

    return this.prisma.$transaction(async (prisma) => {
      const settlement = await prisma.settlement.create({
        data: {
          merchantId: merchant_id,
          totalAmount,
          transactionCount: transactions.length,
          status: 'pending',
          periodStart: new Date(period_start),
          periodEnd: new Date(period_end),
        },
      })

      await prisma.settlementTransaction.createMany({
        data: transactions.map((tx) => ({
          settlementId: settlement.id,
          transactionId: tx.id,
        })),
      })

      return settlement
    })
  }

  async findOne(id: string) {
    const settlement = await this.prisma.settlement.findUnique({
      where: { id },
      include: {
        settlementTransactions: {
          include: { transaction: true },
        },
      },
    })

    if (!settlement) {
      throw new NotFoundException(`Liquidacion con id ${id} no existe`)
    }

    return settlement
  }
}