import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import { Prisma, TransactionStatus } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { CreateTransactionDto } from './dto/create-transaction.dto'
import { UpdateTransactionStatusDto } from './dto/update-transaction-status.dto'
import { QueryTransactionDto } from './dto/query-transaction.dto'

const VALID_TRANSITIONS: Record<TransactionStatus, TransactionStatus[]> = {
  pending: ['approved', 'rejected', 'failed'],
  approved: ['completed', 'failed'],
  rejected: [],
  failed: [],
  completed: [],
}

@Injectable()
export class TransactionsService {
  constructor(
    private prisma: PrismaService,
    @InjectQueue('transactions') private transactionsQueue: Queue,
  ) {}

  private generateReference(): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const random = Math.random().toString(36).toUpperCase().slice(2, 8).padEnd(6, '0')
    return `TXN-${date}-${random}`
  }

  async create(createTransactionDto: CreateTransactionDto) {
    const { merchant_id, amount, currency, type, metadata } = createTransactionDto

    if (!merchant_id) {
      throw new NotFoundException('merchant_id es requerido')
    }

    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchant_id },
    })

    if (!merchant) {
      throw new NotFoundException(`Merchant con id ${merchant_id} no existe`)
    }

    // Reintenta si hay colisión en la referencia (muy improbable pero posible)
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.prisma.transaction.create({
          data: {
            merchantId: merchant_id,
            amount,
            currency,
            type,
            status: 'pending',
            reference: this.generateReference(),
            metadata: metadata ?? undefined,
          },
        })
      } catch (error) {
        const isReferenceConflict =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002' &&
          (error.meta?.target as string[] | undefined)?.includes('reference')

        if (isReferenceConflict && attempt < 2) continue
        throw error
      }
    }
  }

  async findAll(query: QueryTransactionDto) {
    const { page = 1, limit = 20, status, type, date_from, date_to } = query

    if (date_from && date_to && new Date(date_from) > new Date(date_to)) {
      throw new UnprocessableEntityException('date_from no puede ser mayor que date_to')
    }

    const where: Prisma.TransactionWhereInput = {}

    if (status) where.status = status
    if (type) where.type = type
    if (date_from || date_to) {
      where.createdAt = {
        ...(date_from && { gte: new Date(date_from) }),
        ...(date_to && { lte: new Date(date_to) }),
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        skip: (page - 1) * limit,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.transaction.count({ where }),
    ])

    return {
      data,
      meta: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
    }
  }

  async findOne(id: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
    })

    if (!transaction) {
      throw new NotFoundException(`Transaccion con id ${id} no existe`)
    }

    return transaction
  }

  async updateStatus(id: string, updateStatusDto: UpdateTransactionStatusDto) {
    const transaction = await this.findOne(id)
    const { status: newStatus } = updateStatusDto
    const validNext = VALID_TRANSITIONS[transaction.status]

    if (!validNext.includes(newStatus)) {
      throw new UnprocessableEntityException(
        `Transicion de estado invalida: no se puede cambiar de '${transaction.status}' a '${newStatus}'`,
      )
    }

    const updated = await this.prisma.transaction.update({
      where: { id },
      data: { status: newStatus },
    })

    try {
      await this.transactionsQueue.add('status-changed', {
        transactionId: updated.id,
        merchantId: updated.merchantId,
        status: newStatus,
        amount: updated.amount,
        currency: updated.currency,
        reference: updated.reference,
      })
    } catch (error) {
      console.error(`[transactions] Error al encolar evento para tx ${updated.id}:`, error)
    }

    return updated
  }
}
