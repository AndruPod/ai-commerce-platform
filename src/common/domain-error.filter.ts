import { ArgumentsHost, BadRequestException, Catch, ExceptionFilter } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { ScheduleEvaluationError } from '../schedule/domain/evaluate-date';

/** Backstop: domain validation errors that slip past DTO validation become 400s. */
@Catch(ScheduleEvaluationError)
export class DomainErrorFilter extends BaseExceptionFilter implements ExceptionFilter {
  override catch(exception: ScheduleEvaluationError, host: ArgumentsHost): void {
    super.catch(new BadRequestException(exception.message), host);
  }
}
