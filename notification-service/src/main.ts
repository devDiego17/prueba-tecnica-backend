import 'dotenv/config'
import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  app.useGlobalPipes(new ValidationPipe({ transform: true }))
  const port = process.env.PORT ?? 3002
  await app.listen(port)
  console.log(`Notification service corriendo en puerto ${port}`)
}

bootstrap().catch((err) => {
  console.error('Error al iniciar el notification-service:', err)
  process.exit(1)
})
