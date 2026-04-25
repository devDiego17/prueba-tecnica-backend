import { Injectable, ConflictException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { Prisma } from '@prisma/client'
import { CreateMerchantDto } from './dto/create-merchant.dto'
import { v4 as uuidv4 } from 'uuid'

@Injectable()
export class MerchantsService {
  constructor(private prisma: PrismaService) {}

  async create(createMerchantDto: CreateMerchantDto) {
    const { name, email } = createMerchantDto

    try {
      return await this.prisma.merchant.create({
        data: {
          name,
          email,
          api_key: uuidv4(),
          status: 'active',
        },
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('El comercio ya existe con este correo')
      }
      throw error
    }
  }
}
