import { AUTH_EMAIL_VERIFIED_EVENT } from '@/common/constants/events.constant';
import {
  isOperationTimeoutError,
  withTimeout,
} from '@/common/utils/timeout.util';
import { ConfigurationService } from '@/configuration/configuration.service';
import {
  Injectable,
  Logger,
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
  private readonly logger = new Logger(RabbitMqEventsService.name);
  private client: ClientProxy | null = null;

  constructor(private readonly configurationService: ConfigurationService) {}

  async publishAuthEmailVerified(
    payload: AuthEmailVerifiedEvent,
  ): Promise<void> {
    const client = this.getClient();
    const { publishTimeoutMs } = this.configurationService.getRabbitMqConfig();

    try {
      await withTimeout(
        client.connect(),
        publishTimeoutMs,
        'RabbitMQ connect',
      );
      await withTimeout(
        lastValueFrom(client.emit(AUTH_EMAIL_VERIFIED_EVENT, payload)),
        publishTimeoutMs,
        'RabbitMQ publish',
      );
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }

      if (isOperationTimeoutError(error)) {
        this.logger.warn(
          `RabbitMQ auth event publish timed out after ${publishTimeoutMs}ms`,
        );
        throw new ServiceUnavailableException({
          code: 'RABBITMQ_PUBLISH_TIMEOUT',
          message: `RabbitMQ publish timed out after ${publishTimeoutMs}ms`,
        });
      }

      const message =
        error instanceof Error ? error.message : 'RabbitMQ publish failed';
      this.logger.warn(`RabbitMQ auth event publish failed: ${message}`);
      throw new ServiceUnavailableException({
        code: 'RABBITMQ_PUBLISH_FAILED',
        message,
      });
    }
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
