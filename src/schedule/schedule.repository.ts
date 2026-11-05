import { Inject, Injectable } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { Database, DRIZZLE } from '../database/database.module';
import { scheduleExceptions, schedules } from '../database/schema';

export type ScheduleRow = typeof schedules.$inferSelect;
export type ScheduleExceptionRow = typeof scheduleExceptions.$inferSelect;

@Injectable()
export class ScheduleRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async findByProductId(productId: string): Promise<{ schedule: ScheduleRow; exceptions: ScheduleExceptionRow[] } | null> {
    const [schedule] = await this.db.select().from(schedules).where(eq(schedules.productId, productId));
    if (!schedule) return null;
    const exceptions = await this.db
      .select()
      .from(scheduleExceptions)
      .where(eq(scheduleExceptions.scheduleId, schedule.id))
      .orderBy(asc(scheduleExceptions.originalDate), asc(scheduleExceptions.replacementDate));
    return { schedule, exceptions };
  }
}
