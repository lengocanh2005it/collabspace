import { Module, Global } from '@nestjs/common';
import * as amqp from 'amqplib';

@Global()
@Module({
  providers: [
    {
      provide: 'RABBITMQ_CHANNEL',
      useFactory: async () => {
        const url = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
        const connection = await amqp.connect(url);
        const channel = await connection.createChannel();

        // Assert exchange exists as defined in the master definitions.json
        await channel.assertExchange('collabspace_exchange', 'topic', {
          durable: true,
        });

        return channel;
      },
    },
  ],
  exports: ['RABBITMQ_CHANNEL'],
})
export class RabbitMqModule {}
