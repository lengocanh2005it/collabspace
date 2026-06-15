import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import {
  REQUEST_ID_HEADER,
  REQUEST_ID_RESPONSE_HEADER,
  requestIdStorage,
} from './request-id.context';

export type RequestWithId = Request & { requestId: string };

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.headers[REQUEST_ID_HEADER];
  let requestId: string;

  if (typeof incoming === 'string' && incoming.trim()) {
    requestId = incoming.trim();
  } else if (Array.isArray(incoming) && incoming[0]?.trim()) {
    requestId = incoming[0].trim();
  } else {
    requestId = randomUUID();
  }

  (req as RequestWithId).requestId = requestId;
  req.headers[REQUEST_ID_HEADER] = requestId;
  res.setHeader(REQUEST_ID_RESPONSE_HEADER, requestId);

  requestIdStorage.run({ requestId }, () => next());
}
