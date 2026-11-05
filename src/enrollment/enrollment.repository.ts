import { Inject, Injectable } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { Database, DRIZZLE } from '../database/database.module';
import { enrollmentAvailability } from '../database/schema';

export type EnrollmentRow = typeof enrollmentAvailability.$inferSelect;

@Injectable()
export class EnrollmentRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  findByProductId(productId: string): Promise<EnrollmentRow[]> {
    return this.db
      .select()
      .from(enrollmentAvailability)
      .where(eq(enrollmentAvailability.productId, productId))
      .orderBy(asc(enrollmentAvailability.createdAt));
  }
}
