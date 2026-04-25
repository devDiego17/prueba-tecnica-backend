import { Controller, Post, Get, Body, Param, ParseUUIDPipe } from '@nestjs/common'
import { SettlementsService } from './settlements.service'
import { CreateSettlementDto } from './dto/create-settlements.dto'

@Controller('settlements')
export class SettlementsController {
  constructor(private readonly settlementsService: SettlementsService) {}

  @Post('generate')
  generate(@Body() createSettlementDto: CreateSettlementDto) {
    return this.settlementsService.generate(createSettlementDto)
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.settlementsService.findOne(id)
  }
}