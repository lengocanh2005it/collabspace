import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import type { AuthGrpcService } from "../../integrations/auth/auth-grpc.service";
import type { AuthenticatedRequest } from "../http/authenticated-request";
import { AuthGuard } from "./auth.guard";

describe("AuthGuard", () => {
  const originalAllowDev = process.env.ALLOW_DEV_IDENTITY_HEADERS;

  afterEach(() => {
    if (originalAllowDev === undefined) {
      delete process.env.ALLOW_DEV_IDENTITY_HEADERS;
    } else {
      process.env.ALLOW_DEV_IDENTITY_HEADERS = originalAllowDev;
    }
  });

  function createContext(
    request: Partial<AuthenticatedRequest>,
  ): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  }

  it("should verify JWT and attach recipient id", async () => {
    const authGrpcService = {
      verifyAccessToken: jest.fn().mockResolvedValue({ userId: "user-abc" }),
    } as unknown as AuthGrpcService;
    const guard = new AuthGuard(authGrpcService);

    const request = {
      headers: { authorization: "Bearer token" },
    } as unknown as AuthenticatedRequest;

    const result = await guard.canActivate(createContext(request));

    expect(result).toBe(true);
    expect(request.user).toEqual({ id: "user-abc" });
  });

  it("should reject spoofed x-user-id without dev flag or JWT", async () => {
    const authGrpcService = {
      verifyAccessToken: jest.fn(),
    } as unknown as AuthGrpcService;
    const guard = new AuthGuard(authGrpcService);

    const request = {
      headers: { "x-user-id": "attacker" },
    } as unknown as AuthenticatedRequest;

    await expect(guard.canActivate(createContext(request))).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
