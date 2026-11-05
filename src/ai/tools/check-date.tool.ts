import { Injectable } from '@nestjs/common';
import { DateCheckService } from '../../availability/date-check.service';
import { CheckDateArgs } from './tool-args.dto';
import { CommerceTool, functionTool, PRODUCT_SLUG_PROPERTY, ToolContext } from './tool.types';

@Injectable()
export class CheckDateTool implements CommerceTool<CheckDateArgs> {
  readonly name = 'check_date';
  readonly argsClass = CheckDateArgs;
  readonly definition = functionTool(
    this.name,
    'Preferred tool for any date question: joining around a date, whether a class happens on a date, or when the next class is. Returns separate sections: enrollment (status + provenance), requestedDate (weekday, matchesRecurrence), schedule (recurrence, exception knowledge), nextCandidateOccurrences (with status and local times) and limitations. Do not compute weekdays or recurrences yourself.',
    {
      productSlug: PRODUCT_SLUG_PROPERTY,
      date: { type: 'string', description: 'Calendar date YYYY-MM-DD.' },
      timezone: { type: 'string', description: "IANA timezone to interpret the date in. Defaults to the user's timezone when known." },
    },
    ['productSlug', 'date'],
  );

  constructor(private readonly dateCheck: DateCheckService) {}

  applyDefaults(raw: Record<string, unknown>, ctx: ToolContext): Record<string, unknown> {
    return raw.timezone === undefined && ctx.userTimezone ? { ...raw, timezone: ctx.userTimezone } : raw;
  }

  execute(args: CheckDateArgs) {
    return this.dateCheck.check(args.productSlug, args.date, args.timezone);
  }
}
