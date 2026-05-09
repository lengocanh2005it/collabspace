import { AUTH_EMAIL_VERIFIED_EVENT } from '@/common/constants/events.constant';
import { ConfigurationService } from '@/configuration/configuration.service';
import {
  Injectable,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  ClientProxy,
  ClientProxyFactory,
  Transport,
} from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';

type AuthEmailVerifiedEvent = {
  email: string;
  userId: string;
  verifiedAt: string;
};

@Injectable()
export class RabbitMqEventsService implements OnModuleDestroy {
  private client: ClientProxy | null = null;

  constructor(
    private readonly configurationService: ConfigurationService,
  ) {}

  async publishAuthEmailVerified(
    payload: AuthEmailVerifiedEvent,
  ): Promise<void> {
    const client = this.getClient();
    await client.connect();
    await lastValueFrom(client.emit(AUTH_EMAIL_VERIFIED_EVENT, payload));
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.client) {
      return;
    }

    await this.client.close();
    this.client = null;
  }

  private getClient(): ClientProxy {
    if (this.client) {
      return this.client;
    }

    const rabbitMqConfig = this.configurationService.getRabbitMqConfig();

    if (!rabbitMqConfig.enabled || !rabbitMqConfig.url) {
      throw new ServiceUnavailableException({
        code: 'RABBITMQ_UNAVAILABLE',
        message: 'RabbitMQ is not configured for auth events',
      });
    }

    this.client = ClientProxyFactory.create({
      options: {
        queue: rabbitMqConfig.userServiceQueue,
        queueOptions: {
          durable: rabbitMqConfig.queueDurable,
        },
        urls: [rabbitMqConfig.url],
      },
      transport: Transport.RMQ,
    });

    return this.client;
  }
}
