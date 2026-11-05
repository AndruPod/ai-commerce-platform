import { Injectable } from '@nestjs/common';
import { EnrollmentService } from '../../enrollment/enrollment.service';
import { GetEnrollmentArgs } from './tool-args.dto';
import { CommerceTool, functionTool, PRODUCT_SLUG_PROPERTY } from './tool.types';

@Injectable()
export class GetEnrollmentTool implements CommerceTool<GetEnrollmentArgs> {
  readonly name = 'get_enrollment';
  readonly argsClass = GetEnrollmentArgs;
  readonly definition = functionTool(
    this.name,
    'Enrollment availability (OPEN/CLOSED/UNKNOWN) with its window, basis and provenance. Use for "can I join/enroll/sign up" questions without a specific date (for dates use check_date). If the user wants to join, follow it with get_checkout in the same turn.',
    {
      productSlug: PRODUCT_SLUG_PROPERTY,
      date: { type: 'string', description: 'Optional calendar date YYYY-MM-DD; defaults to today.' },
    },
    ['productSlug'],
  );

  constructor(private readonly enrollment: EnrollmentService) {}

  execute(args: GetEnrollmentArgs) {
    return this.enrollment.getForSlug(args.productSlug, args.date);
  }
}
