import { Inject, Injectable } from '@nestjs/common';
import { asc, eq, inArray, or, sql } from 'drizzle-orm';
import { toLookupKey } from '../common/lookup-key';
import { Database, DRIZZLE } from '../database/database.module';
import { businessAliases, businesses, products } from '../database/schema';

export type BusinessRow = typeof businesses.$inferSelect;
export type BusinessMatch = 'SLUG' | 'CANONICAL_NAME' | 'ALIAS';

@Injectable()
export class BusinessRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** Resolves a slug, canonical name or alias ("VSA", "Victory Skating") to one business. */
  async resolve(identifier: string): Promise<{ business: BusinessRow; matchedBy: BusinessMatch; matchedValue: string } | null> {
    const key = toLookupKey(identifier);
    const rows = await this.db
      .select({ business: businesses, alias: businessAliases.alias, aliasKey: businessAliases.aliasKey })
      .from(businesses)
      .leftJoin(businessAliases, eq(businessAliases.businessId, businesses.id))
      .where(
        or(
          eq(businesses.slug, identifier),
          eq(businesses.canonicalNameKey, key),
          sql`${businesses.id} IN (SELECT ${businessAliases.businessId} FROM ${businessAliases} WHERE ${businessAliases.aliasKey} = ${key})`,
        ),
      );
    if (rows.length === 0) return null;

    const business = rows[0].business;
    if (business.slug === identifier) return { business, matchedBy: 'SLUG', matchedValue: business.slug };
    if (business.canonicalNameKey === key) return { business, matchedBy: 'CANONICAL_NAME', matchedValue: business.canonicalName };
    const alias = rows.find((r) => r.aliasKey === key)!.alias!;
    return { business, matchedBy: 'ALIAS', matchedValue: alias };
  }

  async aliasesFor(businessIds: string[]): Promise<Map<string, string[]>> {
    const map = new Map<string, string[]>();
    if (businessIds.length === 0) return map;
    const rows = await this.db
      .select({ businessId: businessAliases.businessId, alias: businessAliases.alias })
      .from(businessAliases)
      .where(inArray(businessAliases.businessId, businessIds))
      .orderBy(asc(businessAliases.alias));
    for (const r of rows) map.set(r.businessId, [...(map.get(r.businessId) ?? []), r.alias]);
    return map;
  }

  productRefs(businessId: string) {
    return this.db
      .select({ slug: products.slug, name: products.name, productType: products.productType, status: products.status })
      .from(products)
      .where(eq(products.businessId, businessId))
      .orderBy(asc(products.name));
  }
}
