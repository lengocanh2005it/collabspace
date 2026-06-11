import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ConfigurationService } from './configuration.service';

@Global() // Đánh dấu Global để không phải import lắt nhắt ở các module khác
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Load file .env cho toàn hệ thống
      envFilePath: '.env', // Đọc từ file .env ở thư mục gốc
    }),
  ],
  providers: [ConfigurationService],
  exports: [ConfigurationService],
})
export class ConfigurationModule {}
