import { Global, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ConfigurationService } from "./configuration.service";

@Global() // Đặt Global để khỏi phải import module này ở khắp mọi nơi
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Đọc file .env có tác dụng toàn cục
    }),
  ],
  providers: [ConfigurationService],
  exports: [ConfigurationService],
})
export class ConfigurationModule {}
