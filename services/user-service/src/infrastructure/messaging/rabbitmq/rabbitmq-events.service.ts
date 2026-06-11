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
import { ConfigurationService } from '../../../configuration/configuration.service';
import {
  USER_REGISTERED_EVENT,
  UserRegisteredEventPayload,
} from '../../../domain/events/user-create.event';
import {
  USER_PROFILE_UPDATED_EVENT,
  UserProfileUpdatedEventPayload,
} from '../../../domain/events/user-profile-update.event';

@Injectable()
export class RabbitMqEventsService implements OnModuleDestroy {
  private taskClient: ClientProxy | null = null;
  private notiClient: ClientProxy | null = null;

  constructor(private readonly config: ConfigurationService) {}

  async publishUserRegistered(
    payload: UserRegisteredEventPayload,
  ): Promise<void> {
    await this.broadcast(USER_REGISTERED_EVENT, payload);
  }

  async publishUserProfileUpdated(
    payload: UserProfileUpdatedEventPayload,
  ): Promise<void> {
    await this.broadcast(USER_PROFILE_UPDATED_EVENT, payload);
  }

  private async broadcast(pattern: string, payload: any): Promise<void> {
    const taskClient = this.getTaskClient();
    const notiClient = this.getNotiClient();

    await taskClient.connect();
    await notiClient.connect();

    console.log(
      `📤 [USER SERVICE] Broadcast event: ${pattern} cho user: ${payload.userId}`,
    );

    await Promise.all([
      lastValueFrom(taskClient.emit(pattern, payload)),
      lastValueFrom(notiClient.emit(pattern, payload)),
    ]);
  }

  private getTaskClient(): ClientProxy {
    if (this.taskClient) return this.taskClient;
    const { url } = this.config.getRabbitMqConfig();
    this.taskClient = ClientProxyFactory.create({
      transport: Transport.RMQ,
      options: {
        urls: [url],
        queue: 'task-service',
        queueOptions: { durable: true },
      },
    });
    return this.taskClient;
  }

  private getNotiClient(): ClientProxy {
    if (this.notiClient) return this.notiClient;
    const { url } = this.config.getRabbitMqConfig();
    this.notiClient = ClientProxyFactory.create({
      transport: Transport.RMQ,
      options: {
        urls: [url],
        queue: 'notification-service',
        queueOptions: { durable: true },
      },
    });
    return this.notiClient;
  }

  async onModuleDestroy() {
    this.taskClient?.close();
    this.notiClient?.close();
  }
}
