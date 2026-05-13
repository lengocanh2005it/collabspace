import { Global, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ConfigurationService } from "./configuration.service";

@Global() // Đặt là Global để các module khác (Task, Notification, v.v.) dùng được luôn mà không cần import lại
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Đọc file .env trên toàn hệ thống
    }),
  ],
  providers: [ConfigurationService],
  exports: [ConfigurationService], // Export để các module khác có thể inject ConfigurationService
})
export class ConfigurationModule {}
