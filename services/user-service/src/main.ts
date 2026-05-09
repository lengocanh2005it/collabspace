import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const dataSource = app.get(DataSource);

  if (process.env.DATABASE_URL && !dataSource.isInitialized) {
    await dataSource.initialize();
  }

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
