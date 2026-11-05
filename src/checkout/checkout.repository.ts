import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, isNotNull } from 'drizzle-orm';
import type { TransactionBlockCode } from '../common/enums';
import { Database, DRIZZLE } from '../database/database.module';
import { checkoutActions, dataQualityIssues, offers } from '../database/schema';

export type CheckoutActionRow = typeof checkoutActions.$inferSelect;

@Injectable()
export class CheckoutRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  findByProductId(productId: string) {
    return this.db
      .select({ action: checkoutActions, offer: offers })
      .from(checkoutActions)
      .leftJoin(offers, eq(offers.id, checkoutActions.offerId))
      .where(eq(checkoutActions.productId, productId))
      .orderBy(asc(checkoutActions.createdAt));
  }

  /** OPEN data-quality issues that block this product's checkout. */
  async openBlockingIssues(productId: string): Promise<{ code: TransactionBlockCode; message: string }[]> {
    const rows = await this.db
      .select({ code: dataQualityIssues.blockingCode, message: dataQualityIssues.explanation })
      .from(dataQualityIssues)
      .where(and(eq(dataQualityIssues.productId, productId), eq(dataQualityIssues.status, 'OPEN'), isNotNull(dataQualityIssues.blockingCode)))
      .orderBy(asc(dataQualityIssues.createdAt));
    return rows.map((r) => ({ code: r.code!, message: r.message }));
  }
}
