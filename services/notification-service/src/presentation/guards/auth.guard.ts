import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthGrpcService } from "../../integrations/auth/auth-grpc.service";
import type { AuthenticatedRequest } from "../http/authenticated-request";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authGrpcService: AuthGrpcService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;

    if (authorization?.trim()) {
      const identity = await this.authGrpcService.verifyAccessTokenLite(authorization);
      request.user = { id: identity.userId };
      return true;
    }

    if (process.env.ALLOW_DEV_IDENTITY_HEADERS === "true") {
      const userId = request.headers["x-user-id"];
      if (typeof userId === "string" && userId.trim()) {
        request.user = { id: userId.trim() };
        return true;
      }
    }

    throw new UnauthorizedException({
      code: "TOKEN_MISSING",
      message: "Authorization header is required",
    });
  }
}
