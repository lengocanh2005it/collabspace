// src/infrastructure/messaging/rabbitmq/rabbitmq.module.ts
import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RabbitMqEventsService } from './rabbitmq-events.service';

@Module({
  imports: [
    // Đăng ký Client kết nối tới RabbitMQ
    ClientsModule.registerAsync([
      {
        name: 'NOTIFICATION_SERVICE', // Đây là cái Token để Inject vào Service
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            // Lấy URL từ file .env (Nhớ là amqp://guest:guest@localhost:5672)
            urls: [configService.get<string>('RABBITMQ_URL') || 'amqp://guest:guest@localhost:5672'],
            
            // Tên cái Queue mà Notification Service đang vểnh tai nghe
            queue: 'notification-service', 
            
            queueOptions: {
              durable: true, // Phải true để giữ tin nhắn không bị mất khi RabbitMQ restart
            },
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  providers: [RabbitMqEventsService],
  exports: [RabbitMqEventsService], // Export ra để mấy cái Handler xài
})
export class RabbitMqModule {}