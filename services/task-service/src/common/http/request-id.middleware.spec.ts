import type { NextFunction, Request, Response } from "express";
import { requestIdMiddleware } from "./request-id.middleware";

describe("requestIdMiddleware", () => {
  function runMiddleware(headers: Record<string, string | string[] | undefined> = {}): {
    req: Request;
    res: Response;
    next: NextFunction;
  } {
    const req = { headers: { ...headers } } as Request;
    const res = {
      setHeader: jest.fn(),
    } as unknown as Response;
    const next = jest.fn() as NextFunction;

    requestIdMiddleware(req, res, next);

    return { req, res, next };
  }

  it("preserves an incoming X-Request-Id header", () => {
    const { req, res, next } = runMiddleware({ "x-request-id": "trace-123" });

    expect((req as Request & { requestId: string }).requestId).toBe("trace-123");
    expect(req.headers["x-request-id"]).toBe("trace-123");
    expect(res.setHeader).toHaveBeenCalledWith("X-Request-Id", "trace-123");
    expect(next).toHaveBeenCalled();
  });

  it("generates a request id when the header is missing", () => {
    const { req, res, next } = runMiddleware();

    const requestId = (req as Request & { requestId: string }).requestId;
    expect(requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(req.headers["x-request-id"]).toBe(requestId);
    expect(res.setHeader).toHaveBeenCalledWith("X-Request-Id", requestId);
    expect(next).toHaveBeenCalled();
  });
});
