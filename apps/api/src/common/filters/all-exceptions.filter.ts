import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

/**
 * Turns any thrown error into a safe, structured JSON response. Users never see Prisma
 * internals or stack traces; developers get full detail in the logs.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Something went wrong. Please try again.';
    let code = 'INTERNAL_ERROR';
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      code = 'HTTP_ERROR';
      if (typeof body === 'string') {
        message = body;
      } else if (body && typeof body === 'object') {
        const b = body as Record<string, unknown>;
        message = (b.message as string) ?? message;
        code = (b.code as string) ?? code;
        details = b.errors ?? b.details;
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      ({ status, message, code } = mapPrismaError(exception));
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      message = 'Invalid data submitted.';
      code = 'VALIDATION_ERROR';
    }

    if (status >= 500) {
      this.logger.error(
        `${req.method} ${req.url} → ${status} ${code}: ${(exception as Error)?.message}`,
        (exception as Error)?.stack,
      );
    } else {
      this.logger.warn(`${req.method} ${req.url} → ${status} ${code}: ${message}`);
    }

    res.status(status).json({
      statusCode: status,
      code,
      message,
      ...(details ? { details } : {}),
      timestamp: new Date().toISOString(),
      path: req.url,
    });
  }
}

function mapPrismaError(e: Prisma.PrismaClientKnownRequestError): {
  status: number;
  message: string;
  code: string;
} {
  switch (e.code) {
    case 'P2002':
      return {
        status: HttpStatus.CONFLICT,
        message: 'A record with this value already exists.',
        code: 'DUPLICATE',
      };
    case 'P2025':
      return {
        status: HttpStatus.NOT_FOUND,
        message: 'The requested record was not found.',
        code: 'NOT_FOUND',
      };
    case 'P2003':
      return {
        status: HttpStatus.BAD_REQUEST,
        message: 'Related record is missing or invalid.',
        code: 'FK_CONSTRAINT',
      };
    default:
      return {
        status: HttpStatus.BAD_REQUEST,
        message: 'The request could not be completed.',
        code: `DB_${e.code}`,
      };
  }
}
