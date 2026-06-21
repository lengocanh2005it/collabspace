import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ValidationPipe } from '@nestjs/common';
import compression from 'compression';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(compression());

  const corsOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim());
  app.enableCors({ origin: corsOrigins, credentials: true });

  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  app.setGlobalPrefix('api/v1');

  if (process.env.SWAGGER_ENABLED !== 'false') {
    const { DocumentBuilder, SwaggerModule } = await import('@nestjs/swagger');
    const config = new DocumentBuilder()
      .setTitle('Analytics Service API')
      .setDescription('CollabSpace admin analytics — platform overview, timeseries, health.')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    const swaggerPath = process.env.SWAGGER_UI_PATH?.trim() || 'swagger';
    SwaggerModule.setup(swaggerPath, app, document);
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Analytics Service is running on port ${port}`);
}

void bootstrap();
