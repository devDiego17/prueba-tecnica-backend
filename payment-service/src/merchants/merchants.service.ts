import { Injectable, ConflictException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateMerchantDto } from './dto/create-merchant.dto'
import { v4 as uuidv4 } from 'uuid'

@Injectable()
export class MerchantsService {
  
  constructor(private prisma: PrismaService) {}

  async create(createMerchantDto: CreateMerchantDto) {
    const { name, email } = createMerchantDto

    const existing = await this.prisma.merchant.findUnique({
      where: { email },
    })

    if (existing) {
      throw new ConflictException('El comercio ya existe con este correo');
    }

    return this.prisma.merchant.create({
      data: {
        name,
        email,
        api_key: uuidv4(),
        status: 'active',
      }
    })
  }
}