import type { Request } from "express";
import type { IncomingHttpHeaders } from "node:http";

type RequestParams = Record<string, string | undefined>;
type RequestQuery = Record<string, string | string[] | undefined>;

export interface AuthenticatedUser {
  id: string;
  name: string;
}

export interface WorkspaceRequestContext {
  id: string;
  userId: string;
}

export type CollabSpaceHeaders = IncomingHttpHeaders & {
  "x-request-id"?: string;
  "x-user-id"?: string;
  "x-user-name"?: string;
};

export type AppRequest<
  Params extends RequestParams = RequestParams,
  ResponseBody = unknown,
  RequestBody = unknown,
  Query extends RequestQuery = RequestQuery,
> = Request<Params, ResponseBody, RequestBody, Query> & {
  headers: CollabSpaceHeaders;
  user: AuthenticatedUser;
  workspace?: WorkspaceRequestContext;
};

export function getHeaderValue(
  headers: CollabSpaceHeaders,
  headerName: string,
): string | undefined {
  const value = headers[headerName];

  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value[0];
  }

  return undefined;
}
