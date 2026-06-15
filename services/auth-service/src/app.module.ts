import { Module } from '@nestjs/common';
import { ChangePasswordUseCase } from '@/application/use-cases/change-password.use-case';
import { ForgotPasswordUseCase } from '@/application/use-cases/forgot-password.use-case';
import { GetCurrentUserUseCase } from '@/application/use-cases/get-current-user.use-case';
import { ListSessionsUseCase } from '@/application/use-cases/list-sessions.use-case';
import { LoginUseCase } from '@/application/use-cases/login.use-case';
import { LogoutAllUseCase } from '@/application/use-cases/logout-all.use-case';
import { LogoutOthersUseCase } from '@/application/use-cases/logout-others.use-case';
import { LogoutUseCase } from '@/application/use-cases/logout.use-case';
import { RefreshSessionUseCase } from '@/application/use-cases/refresh-session.use-case';
import { RegisterUseCase } from '@/application/use-cases/register.use-case';
import { ResendEmailVerificationOtpUseCase } from '@/application/use-cases/resend-email-verification-otp.use-case';
import { ResetPasswordUseCase } from '@/application/use-cases/reset-password.use-case';
import { RevokeSessionUseCase } from '@/application/use-cases/revoke-session.use-case';
import { VerifyAccessTokenLiteUseCase } from '@/application/use-cases/verify-access-token-lite.use-case';
import { VerifyAccessTokenUseCase } from '@/application/use-cases/verify-access-token.use-case';
import { VerifyEmailOtpUseCase } from '@/application/use-cases/verify-email-otp.use-case';
import { EmailVerificationOtpService } from '@/application/services/email-verification-otp.service';
import { PasswordResetTokenService } from '@/application/services/password-reset-token.service';
import { JwtTokenService } from '@/application/services/jwt-token.service';
import { SessionIssuanceService } from '@/application/services/session-issuance.service';
import { UserProfileResolverService } from '@/application/services/user-profile-resolver.service';
import { ConfigurationModule } from '@/configuration/configuration.module';
import { EMAIL_OUTBOX } from '@/domain/ports/email-outbox.port';
import { OTP_STORE } from '@/domain/ports/otp-store.port';
import { REFRESH_TOKEN_REPOSITORY } from '@/domain/repositories/refresh-token.repository';
import { USER_REPOSITORY } from '@/domain/repositories/user.repository';
import { UserProfilesModule } from '@/integrations/user-profiles/user-profiles.module';
import { TypeOrmEmailOutboxAdapter } from '@/infrastructure/outbox/typeorm-email-outbox.adapter';
import { AccessTokenVerifyLiteCacheService } from '@/infrastructure/redis/access-token-verify-lite-cache.service';
import { RedisOtpStoreAdapter } from '@/infrastructure/redis/redis-otp-store.adapter';
import { InMemoryUserRepository } from '@/infrastructure/repositories/in-memory-user.repository';
import { TypeOrmRefreshTokenRepository } from '@/infrastructure/repositories/typeorm-refresh-token.repository';
import { TypeOrmUserRepository } from '@/infrastructure/repositories/typeorm-user.repository';
import { DatabaseModule } from '@/infrastructure/database/database.module';
import { EmailsModule } from '@/infrastructure/emails/emails.module';
import { GraphileWorkerModule } from '@/infrastructure/graphile-worker/graphile-worker.module';
import { IdentityModule } from '@/infrastructure/identity/identity.module';
import { OutboxModule } from '@/infrastructure/outbox/outbox.module';
import { RefreshTokensModule } from '@/infrastructure/refresh-tokens/refresh-tokens.module';
import { RedisModule } from '@/infrastructure/redis/redis.module';
import { AuthHealthService } from '@/health/auth-health.service';
import { MetricsModule } from '@/metrics/metrics.module';
import { AuthGrpcController } from '@/presentation/grpc/auth.grpc.controller';
import { AuthController } from '@/presentation/http/auth.controller';
import { AuthAdminController } from '@/presentation/http/auth-admin.controller';
import { platformAdminAuthProviders } from '@/presentation/http/platform-admin-auth.providers';
import { ManageAuthAdminUseCase } from '@/application/use-cases/manage-auth-admin.use-case';
import { AUTH_ADMIN_REPOSITORY } from '@/domain/repositories/auth-admin.repository';
import { TypeOrmAuthAdminRepository } from '@/infrastructure/repositories/typeorm-auth-admin.repository';
import { InMemoryAuthAdminRepository } from '@/infrastructure/repositories/in-memory-auth-admin.repository';

@Module({
  imports: [
    ConfigurationModule,
    MetricsModule,
    DatabaseModule,
    EmailsModule,
    GraphileWorkerModule,
    IdentityModule,
    UserProfilesModule,
    OutboxModule,
    RefreshTokensModule,
    RedisModule,
  ],
  controllers: [AuthController, AuthAdminController, AuthGrpcController],
  providers: [
    JwtTokenService,
    UserProfileResolverService,
    SessionIssuanceService,
    EmailVerificationOtpService,
    PasswordResetTokenService,
    VerifyAccessTokenUseCase,
    VerifyAccessTokenLiteUseCase,
    GetCurrentUserUseCase,
    LoginUseCase,
    LogoutUseCase,
    RefreshSessionUseCase,
    RegisterUseCase,
    ResendEmailVerificationOtpUseCase,
    VerifyEmailOtpUseCase,
    ChangePasswordUseCase,
    ForgotPasswordUseCase,
    ResetPasswordUseCase,
    ListSessionsUseCase,
    RevokeSessionUseCase,
    LogoutOthersUseCase,
    LogoutAllUseCase,
    ManageAuthAdminUseCase,
    ...platformAdminAuthProviders,
    TypeOrmUserRepository,
    InMemoryUserRepository,
    TypeOrmAuthAdminRepository,
    InMemoryAuthAdminRepository,
    TypeOrmRefreshTokenRepository,
    RedisOtpStoreAdapter,
    AccessTokenVerifyLiteCacheService,
    TypeOrmEmailOutboxAdapter,
    {
      provide: USER_REPOSITORY,
      inject: [TypeOrmUserRepository, InMemoryUserRepository],
      useFactory: (
        typeOrmUserRepository: TypeOrmUserRepository,
        inMemoryUserRepository: InMemoryUserRepository,
      ) =>
        process.env.DATABASE_URL
          ? typeOrmUserRepository
          : inMemoryUserRepository,
    },
    {
      provide: AUTH_ADMIN_REPOSITORY,
      inject: [TypeOrmAuthAdminRepository, InMemoryAuthAdminRepository],
      useFactory: (
        typeOrmRepository: TypeOrmAuthAdminRepository,
        inMemoryRepository: InMemoryAuthAdminRepository,
      ) => (process.env.DATABASE_URL ? typeOrmRepository : inMemoryRepository),
    },
    {
      provide: REFRESH_TOKEN_REPOSITORY,
      useExisting: TypeOrmRefreshTokenRepository,
    },
    {
      provide: OTP_STORE,
      useExisting: RedisOtpStoreAdapter,
    },
    {
      provide: EMAIL_OUTBOX,
      useExisting: TypeOrmEmailOutboxAdapter,
    },
    AuthHealthService,
  ],
})
export class AppModule {}
