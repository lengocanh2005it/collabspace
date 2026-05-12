import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ConfigurationService {
  constructor(private configService: ConfigService) {}

  // Lấy cấu hình RabbitMQ
  getRabbitMqConfig(): { url: string } {
    return {
      // Ưu tiên lấy từ file .env, nếu không có thì dùng localhost mặc định
      url: this.configService.get<string>('RABBITMQ_URL') || 'amqp://localhost:5672',
    };
  }

  // Tiện tay tạo luôn cấu hình MongoDB (nếu User Service đang cần)
  getMongoConfig(): { uri: string } {
    return {
      uri: this.configService.get<string>('MONGODB_URI') || 'mongodb://localhost:27017/user-db',
    };
  }
}