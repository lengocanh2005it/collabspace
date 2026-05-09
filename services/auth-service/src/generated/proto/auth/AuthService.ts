// Original file: E:/collabspace/services/auth-service/proto/auth.proto

import type * as grpc from '@grpc/grpc-js';
import type { MethodDefinition } from '@grpc/proto-loader';
import type {
  VerifyAccessTokenRequest as _auth_VerifyAccessTokenRequest,
  VerifyAccessTokenRequest__Output as _auth_VerifyAccessTokenRequest__Output,
} from '../auth/VerifyAccessTokenRequest';
import type {
  VerifyAccessTokenResponse as _auth_VerifyAccessTokenResponse,
  VerifyAccessTokenResponse__Output as _auth_VerifyAccessTokenResponse__Output,
} from '../auth/VerifyAccessTokenResponse';

export interface AuthServiceClient extends grpc.Client {
  VerifyAccessToken(
    argument: _auth_VerifyAccessTokenRequest,
    metadata: grpc.Metadata,
    options: grpc.CallOptions,
    callback: grpc.requestCallback<_auth_VerifyAccessTokenResponse__Output>,
  ): grpc.ClientUnaryCall;
  VerifyAccessToken(
    argument: _auth_VerifyAccessTokenRequest,
    metadata: grpc.Metadata,
    callback: grpc.requestCallback<_auth_VerifyAccessTokenResponse__Output>,
  ): grpc.ClientUnaryCall;
  VerifyAccessToken(
    argument: _auth_VerifyAccessTokenRequest,
    options: grpc.CallOptions,
    callback: grpc.requestCallback<_auth_VerifyAccessTokenResponse__Output>,
  ): grpc.ClientUnaryCall;
  VerifyAccessToken(
    argument: _auth_VerifyAccessTokenRequest,
    callback: grpc.requestCallback<_auth_VerifyAccessTokenResponse__Output>,
  ): grpc.ClientUnaryCall;
  verifyAccessToken(
    argument: _auth_VerifyAccessTokenRequest,
    metadata: grpc.Metadata,
    options: grpc.CallOptions,
    callback: grpc.requestCallback<_auth_VerifyAccessTokenResponse__Output>,
  ): grpc.ClientUnaryCall;
  verifyAccessToken(
    argument: _auth_VerifyAccessTokenRequest,
    metadata: grpc.Metadata,
    callback: grpc.requestCallback<_auth_VerifyAccessTokenResponse__Output>,
  ): grpc.ClientUnaryCall;
  verifyAccessToken(
    argument: _auth_VerifyAccessTokenRequest,
    options: grpc.CallOptions,
    callback: grpc.requestCallback<_auth_VerifyAccessTokenResponse__Output>,
  ): grpc.ClientUnaryCall;
  verifyAccessToken(
    argument: _auth_VerifyAccessTokenRequest,
    callback: grpc.requestCallback<_auth_VerifyAccessTokenResponse__Output>,
  ): grpc.ClientUnaryCall;
}

export interface AuthServiceHandlers extends grpc.UntypedServiceImplementation {
  VerifyAccessToken: grpc.handleUnaryCall<
    _auth_VerifyAccessTokenRequest__Output,
    _auth_VerifyAccessTokenResponse
  >;
}

export interface AuthServiceDefinition extends grpc.ServiceDefinition {
  VerifyAccessToken: MethodDefinition<
    _auth_VerifyAccessTokenRequest,
    _auth_VerifyAccessTokenResponse,
    _auth_VerifyAccessTokenRequest__Output,
    _auth_VerifyAccessTokenResponse__Output
  >;
}
