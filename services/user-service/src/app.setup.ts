import { INestApplication, ValidationPipe } from '@nestjs/common';

export function configureHttpApp(app: INestApplication): void {
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      whitelist: true,
    }),
  );
  app.setGlobalPrefix('api/v1');
}
