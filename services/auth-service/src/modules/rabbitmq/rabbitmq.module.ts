import { Module } from '@nestjs/common';
import { RabbitMqEventsService } from './rabbitmq-events.service';

@Module({
  providers: [RabbitMqEventsService],
  exports: [RabbitMqEventsService],
})
export class RabbitMqModule {}
