import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const mapping: Record<string, { status: number; message: string }> = {
      P2002: { status: HttpStatus.CONFLICT, message: 'يوجد سجل آخر بالقيم الفريدة نفسها' },
      P2003: { status: HttpStatus.CONFLICT, message: 'لا يمكن تنفيذ العملية لارتباط السجل ببيانات أخرى' },
      P2025: { status: HttpStatus.NOT_FOUND, message: 'السجل المطلوب غير موجود' },
    };
    const mapped = mapping[exception.code] || {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'تعذر تنفيذ عملية قاعدة البيانات',
    };

    this.logger.error(`Prisma operation failed with code ${exception.code}`);
    response.status(mapped.status).json({
      statusCode: mapped.status,
      message: mapped.message,
      error: HttpStatus[mapped.status],
      timestamp: new Date().toISOString(),
    });
  }
}
