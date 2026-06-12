import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ConfigurationService {
  constructor(private configService: ConfigService) {}

  getRabbitMqConfig(): { url: string } {
    const url = this.configService.get<string>('RABBITMQ_URL');
    if (!url) throw new Error('RABBITMQ_URL is required');
    return { url };
  }
}
