import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateTransactionDto } from './dto/create-transaction.dto'
import { UpdateTransactionStatusDto } from './dto/update-transaction-status.dto'
import { QueryTransactionDto } from './dto/query-transaction.dto'
import { TransactionStatus } from '@prisma/client'

const VALID_TRANSITIONS: Record<TransactionStatus, TransactionStatus[]> = {
  pending: ['approved', 'rejected', 'failed'],
  approved: ['completed', 'failed'],
  rejected: [],
  failed: [],
  completed: [],
}

@Injectable()
export class TransactionsService {
  constructor(private prisma: PrismaService) {}

  private generateReference(): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const random = Math.random().toString(36).toUpperCase().slice(2, 8)
    return `TXN-${date}-${random}`
  }

 private async generateUniqueReference(): Promise<string> {
  let reference = this.generateReference()
  
  while (await this.prisma.transaction.findUnique({ where: { reference } })) {
    reference = this.generateReference()
  }

  return reference
}

  async create(createTransactionDto: CreateTransactionDto) {
    const { merchant_id, amount, currency, type, metadata } = createTransactionDto

    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchant_id },
    })

    if (!merchant) {
      throw new NotFoundException(`Merchant con id ${merchant_id} no existe`)
    }

    const reference = await this.generateUniqueReference()

    return this.prisma.transaction.create({
      data: {
        merchantId: merchant_id,
        amount,
        currency,
        type,
        status: 'pending',
        reference,
        metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined,
      },
    })
  }

  async findAll(query: QueryTransactionDto) {
    const { page = 1, limit = 20, status, type, date_from, date_to } = query

    const where: any = {}

    if (status) where.status = status
    if (type) where.type = type
    if (date_from || date_to) {
      where.createdAt = {}
      if (date_from) where.createdAt.gte = new Date(date_from)
      if (date_to) where.createdAt.lte = new Date(date_to)
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
        `Transicion de estado invalida: no se puede cambiar de '${transaction.status}' a '${newStatus}'`
      )
    }

    return this.prisma.transaction.update({
      where: { id },
      data: { status: newStatus },
    })
  }
}