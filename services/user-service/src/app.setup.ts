import { INestApplication, ValidationPipe } from '@nestjs/common';
import { registerRequestIdMiddleware } from './common/http/register-request-id.middleware';

export function configureHttpApp(app: INestApplication): void {
  registerRequestIdMiddleware(app);
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
