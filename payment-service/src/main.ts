import 'dotenv/config'
import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  app.useGlobalPipes(new ValidationPipe({ transform: true }))
  const port = process.env.PORT ?? 3001
  await app.listen(port)
  console.log(`Payment service corriendo en puerto ${port}`)
}
bootstrap()