import { Injectable, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import { ClientProxy, ClientProxyFactory, Transport } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';
import { ConfigurationService } from 'src/configuration/configuration.service'; // Chỉnh lại đường dẫn tuỳ project bạn
import { TASK_ASSIGNED_EVENT, TaskAssignedEventPayload } from '../../../domain/events/task.events';
import { TASK_COMMENTED_EVENT, TaskCommentedEventPayload} from '../../../domain/events/comment.events'

@Injectable()
export class RabbitMqEventsService implements OnModuleDestroy {
  private client: ClientProxy | null = null;

  constructor(private readonly configurationService: ConfigurationService) {}

  async publishTaskAssigned(payload: TaskAssignedEventPayload): Promise<void> {
    const client = this.getClient();
    await client.connect();
    // Bắn event với pattern là routing_key 'task_assigned'
    await lastValueFrom(client.emit(TASK_ASSIGNED_EVENT, payload));
  }

  async publishTaskCommented(payload: TaskCommentedEventPayload): Promise<void> {
    const client = this.getClient(); // Dùng logic getClient hiện tại của ông
    await client.connect();
    
    console.log(`📤 [RABBITMQ] Đang bắn event: ${TASK_COMMENTED_EVENT}`);
    
    // Bắn đi với Constant Event Name
    await lastValueFrom(client.emit(TASK_COMMENTED_EVENT, payload));
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
  }

  private getClient(): ClientProxy {
    if (this.client) return this.client;

    const { url: rmqUrl } = this.configurationService.getRabbitMqConfig();

    if (!rmqUrl) {
      throw new ServiceUnavailableException('RabbitMQ URL is not configured');
    }

    this.client = ClientProxyFactory.create({
      transport: Transport.RMQ,
      options: {
        urls: [rmqUrl],
        queue: 'task-service', // Trỏ thẳng vào queue theo cấu hình JSON của bạn
        queueOptions: {
          durable: true,
        },
      },
    });

    return this.client;
  }
}