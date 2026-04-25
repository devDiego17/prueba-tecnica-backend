import { Controller, Post, Body } from '@nestjs/common'
import { MerchantsService } from './merchants.service'
import { CreateMerchantDto } from './dto/create-merchant.dto'

@Controller('merchants')
export class MerchantsController {
  constructor(private readonly merchantsService: MerchantsService) {}

  @Post()
  create(@Body() createMerchantDto: CreateMerchantDto) {
    return this.merchantsService.create(createMerchantDto)
  }
}