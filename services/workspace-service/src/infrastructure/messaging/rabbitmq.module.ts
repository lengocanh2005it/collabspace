import { DynamicModule, Global, Module } from '@nestjs/common';
import * as amqp from 'amqplib';
import { getWorkspaceOutboxPublishMode } from '../outbox/workspace-outbox.config';

@Global()
@Module({})
export class RabbitMqModule {
  static forRoot(): DynamicModule {
    if (getWorkspaceOutboxPublishMode() === 'debezium') {
      return {
        module: RabbitMqModule,
        providers: [],
        exports: [],
      };
    }

    return {
      module: RabbitMqModule,
      providers: [
        {
          provide: 'RABBITMQ_CHANNEL',
          useFactory: async () => {
            const url = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
            const connection = await amqp.connect(url);
            const channel = await connection.createChannel();

            await channel.assertExchange('collabspace_exchange', 'topic', {
              durable: true,
            });

            return channel;
          },
        },
      ],
      exports: ['RABBITMQ_CHANNEL'],
    };
  }
}
