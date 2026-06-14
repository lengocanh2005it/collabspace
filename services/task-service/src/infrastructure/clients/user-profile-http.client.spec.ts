import { ConfigService } from "@nestjs/config";
import { UserProfileHttpClient } from "./user-profile-http.client";

describe("UserProfileHttpClient (task-service)", () => {
  const originalFetch = global.fetch;
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.NODE_ENV = originalNodeEnv;
    jest.restoreAllMocks();
  });

  function createClient(options?: {
    serviceJwtSecret?: string;
  }): UserProfileHttpClient {
    const configService = {
      get: jest.fn((key: string) => {
        if (key === "USER_SERVICE_URL") {
          return "http://user-service:3000";
        }
        if (key === "USER_SERVICE_TIMEOUT_MS") {
          return "3000";
        }
        if (key === "SERVICE_JWT_SECRET") {
          return options?.serviceJwtSecret;
        }
        return undefined;
      }),
    } as unknown as ConfigService;

    return new UserProfileHttpClient(configService);
  }

  it("sends service JWT when SERVICE_JWT_SECRET is configured", async () => {
    process.env.NODE_ENV = "production";
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => [],
    });

    const client = createClient({
      serviceJwtSecret: "phase-3-service-jwt-secret",
    });

    await client.lookupReplicas({ username: "jane.doe" });

    const [, requestInit] = (global.fetch as jest.Mock).mock.calls[0] as [
      string,
      { headers: Record<string, string> },
    ];

    expect(requestInit.headers.Authorization).toMatch(/^Bearer /);
  });
});
