import { type ExecutionContext, UnauthorizedException } from "@nestjs/common";
import type { AuthGrpcService } from "../../integrations/auth/auth-grpc.service";
import type { AppRequest } from "../http/request-context";
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

  function createContext(request: Partial<AppRequest>): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  }

  it("should verify JWT and attach user from auth gRPC", async () => {
    const authGrpcService = {
      verifyAccessTokenLite: jest.fn().mockResolvedValue({ userId: "user-abc" }),
      verifyAccessToken: jest.fn(),
    } as unknown as AuthGrpcService;
    const guard = new AuthGuard(authGrpcService);

    const request = {
      headers: {
        authorization: "Bearer token",
        "x-user-name": "Alice",
      },
    } as unknown as AppRequest;

    const result = await guard.canActivate(createContext(request));

    expect(result).toBe(true);
    expect(authGrpcService.verifyAccessTokenLite).toHaveBeenCalledWith("Bearer token");
    expect(authGrpcService.verifyAccessToken).not.toHaveBeenCalled();
    expect(request.user).toEqual({ id: "user-abc", name: "Alice" });
  });

  it("should allow dev identity headers when explicitly enabled", async () => {
    process.env.ALLOW_DEV_IDENTITY_HEADERS = "true";
    const authGrpcService = {
      verifyAccessTokenLite: jest.fn(),
      verifyAccessToken: jest.fn(),
    } as unknown as AuthGrpcService;
    const guard = new AuthGuard(authGrpcService);

    const request = {
      headers: {
        "x-user-id": "dev-user",
        "x-user-name": "Dev",
      },
    } as unknown as AppRequest;

    const result = await guard.canActivate(createContext(request));

    expect(result).toBe(true);
    expect(authGrpcService.verifyAccessTokenLite).not.toHaveBeenCalled();
    expect(request.user).toEqual({ id: "dev-user", name: "Dev" });
  });

  it("should reject requests without authorization or dev headers", async () => {
    const authGrpcService = {
      verifyAccessTokenLite: jest.fn(),
      verifyAccessToken: jest.fn(),
    } as unknown as AuthGrpcService;
    const guard = new AuthGuard(authGrpcService);

    const request = { headers: {} } as unknown as AppRequest;

    await expect(guard.canActivate(createContext(request))).rejects.toThrow(UnauthorizedException);
  });
});
