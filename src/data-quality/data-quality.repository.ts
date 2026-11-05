import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, isNotNull } from 'drizzle-orm';
import { Database, DRIZZLE } from '../database/database.module';
import { checkoutActions, dataQualityIssues } from '../database/schema';

export type DataQualityIssueRow = typeof dataQualityIssues.$inferSelect;

@Injectable()
export class DataQualityRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  findByProductId(productId: string): Promise<DataQualityIssueRow[]> {
    return this.db
      .select()
      .from(dataQualityIssues)
      .where(eq(dataQualityIssues.productId, productId))
      .orderBy(asc(dataQualityIssues.createdAt), asc(dataQualityIssues.fieldPath));
  }

  /** First observed checkout price for the product (evidence for checkout.* issues). */
  async checkoutObservation(productId: string) {
    const [row] = await this.db
      .select({
        amountMinor: checkoutActions.observedAmountMinor,
        currency: checkoutActions.observedCurrency,
        billing: checkoutActions.observedBilling,
        observedAt: checkoutActions.observedAt,
      })
      .from(checkoutActions)
      .where(and(eq(checkoutActions.productId, productId), isNotNull(checkoutActions.observedAmountMinor)))
      .orderBy(asc(checkoutActions.createdAt))
      .limit(1);
    return row ? { amountMinor: row.amountMinor!, currency: row.currency!, billing: row.billing, observedAt: row.observedAt } : null;
  }
}
