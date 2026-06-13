import { Module } from '@nestjs/common';
import { ChangePasswordUseCase } from '@/application/use-cases/change-password.use-case';
import { GetCurrentUserUseCase } from '@/application/use-cases/get-current-user.use-case';
import { LoginUseCase } from '@/application/use-cases/login.use-case';
import { LogoutUseCase } from '@/application/use-cases/logout.use-case';
import { RefreshSessionUseCase } from '@/application/use-cases/refresh-session.use-case';
import { RegisterUseCase } from '@/application/use-cases/register.use-case';
import { ResendEmailVerificationOtpUseCase } from '@/application/use-cases/resend-email-verification-otp.use-case';
import { VerifyAccessTokenUseCase } from '@/application/use-cases/verify-access-token.use-case';
import { VerifyEmailOtpUseCase } from '@/application/use-cases/verify-email-otp.use-case';
import { EmailVerificationOtpService } from '@/application/services/email-verification-otp.service';
import { JwtTokenService } from '@/application/services/jwt-token.service';
import { SessionIssuanceService } from '@/application/services/session-issuance.service';
import { UserProfileResolverService } from '@/application/services/user-profile-resolver.service';
import { ConfigurationModule } from '@/configuration/configuration.module';
import { DatabaseModule } from '@/modules/database/database.module';
import { EmailsModule } from '@/modules/emails/emails.module';
import { GraphileWorkerModule } from '@/modules/graphile-worker/graphile-worker.module';
import { IdentityModule } from '@/modules/identity/identity.module';
import { OutboxModule } from '@/modules/outbox/outbox.module';
import { RefreshTokensModule } from '@/modules/refresh-tokens/refresh-tokens.module';
import { RedisModule } from '@/modules/redis/redis.module';
import { AuthHealthService } from '@/health/auth-health.service';
import { MetricsModule } from '@/metrics/metrics.module';
import { AuthGrpcController } from '@/presentation/grpc/auth.grpc.controller';
import { AuthController } from '@/presentation/http/auth.controller';
import { AuthService } from './app.service';

@Module({
  imports: [
    ConfigurationModule,
    MetricsModule,
    DatabaseModule,
    EmailsModule,
    GraphileWorkerModule,
    IdentityModule,
    OutboxModule,
    RefreshTokensModule,
    RedisModule,
  ],
  controllers: [AuthController, AuthGrpcController],
  providers: [
    JwtTokenService,
    UserProfileResolverService,
    SessionIssuanceService,
    EmailVerificationOtpService,
    VerifyAccessTokenUseCase,
    GetCurrentUserUseCase,
    LoginUseCase,
    LogoutUseCase,
    RefreshSessionUseCase,
    RegisterUseCase,
    ResendEmailVerificationOtpUseCase,
    VerifyEmailOtpUseCase,
    ChangePasswordUseCase,
    AuthService,
    AuthHealthService,
  ],
})
export class AppModule {}
