import { Module } from '@nestjs/common';
import { RabbitMqEventsService } from 'src/infrastructure/messaging/rabbitmq/rabbitmq-events.service';

@Module({
  providers: [RabbitMqEventsService],
  exports: [RabbitMqEventsService],
})
export class RabbitMqModule {}