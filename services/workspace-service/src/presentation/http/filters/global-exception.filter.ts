import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { getRequestIdFromRequest } from '../../../common/http/request-id.context';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.message
        : 'Internal server error';
    const requestId = getRequestIdFromRequest(request);
    const requestLabel = requestId
      ? `[${requestId}] [${request.method}] ${request.url}`
      : `[${request.method}] ${request.url}`;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    if (Number(status) === HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${requestLabel} - ${exception instanceof Error ? exception.message : String(exception)}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(`${requestLabel} - ${status} - ${message}`);
    }

    if (requestId) {
      response.setHeader('X-Request-Id', requestId);
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
      ...(requestId ? { requestId } : {}),
    });
  }
}
