import { Inject, Injectable } from '@nestjs/common';
import { and, asc, count, eq, ilike, inArray, or, sql, SQL } from 'drizzle-orm';
import type { DeliveryMode, Discipline, ExperienceLevel } from '../common/enums';
import { Database, DRIZZLE } from '../database/database.module';
import {
  accessPolicies,
  businessAliases,
  businesses,
  coaches,
  dataQualityIssues,
  offers,
  productAudienceLevels,
  productCoaches,
  productRequirements,
  products,
  programs,
} from '../database/schema';

export type ProductRow = typeof products.$inferSelect;
export type BusinessRow = typeof businesses.$inferSelect;
export type ProgramRow = typeof programs.$inferSelect;
export type OfferRow = typeof offers.$inferSelect;
export type AudienceRow = typeof productAudienceLevels.$inferSelect;
export type AccessPolicyRow = typeof accessPolicies.$inferSelect;
export type RequirementRow = typeof productRequirements.$inferSelect;

export interface ProductListFilters {
  businessId?: string;
  discipline?: Discipline;
  deliveryMode?: DeliveryMode;
  level?: ExperienceLevel;
  durationMonths?: number;
  q?: string;
}

export interface ProductWithBusiness {
  product: ProductRow;
  business: BusinessRow;
  program: ProgramRow | null;
}

@Injectable()
export class ProductRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  private baseQuery() {
    return this.db
      .select({ product: products, business: businesses, program: programs })
      .from(products)
      .innerJoin(businesses, eq(businesses.id, products.businessId))
      .leftJoin(programs, eq(programs.productId, products.id));
  }

  async findBySlug(slug: string): Promise<ProductWithBusiness | null> {
    const [row] = await this.baseQuery().where(eq(products.slug, slug)).limit(1);
    return row ?? null;
  }

  list(f: ProductListFilters): Promise<ProductWithBusiness[]> {
    const conds: SQL[] = [eq(products.status, 'ACTIVE')];
    if (f.businessId) conds.push(eq(products.businessId, f.businessId));
    if (f.discipline) conds.push(eq(products.discipline, f.discipline));
    if (f.deliveryMode) conds.push(eq(products.deliveryMode, f.deliveryMode));
    if (f.durationMonths) conds.push(eq(programs.durationMonths, f.durationMonths));
    if (f.level) {
      conds.push(
        sql`EXISTS (SELECT 1 FROM ${productAudienceLevels} WHERE ${productAudienceLevels.productId} = ${products.id} AND ${productAudienceLevels.level} = ${f.level})`,
      );
    }
    if (f.q) {
      const pattern = `%${f.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      conds.push(
        or(
          ilike(products.name, pattern),
          ilike(products.description, pattern),
          ilike(businesses.canonicalName, pattern),
          sql`EXISTS (SELECT 1 FROM ${businessAliases} WHERE ${businessAliases.businessId} = ${businesses.id} AND ${businessAliases.alias} ILIKE ${pattern})`,
        )!,
      );
    }
    return this.baseQuery()
      .where(and(...conds))
      .orderBy(asc(products.name));
  }

  async audienceLevels(productIds: string[]): Promise<Map<string, AudienceRow[]>> {
    const map = new Map<string, AudienceRow[]>();
    if (productIds.length === 0) return map;
    const rows = await this.db
      .select()
      .from(productAudienceLevels)
      .where(inArray(productAudienceLevels.productId, productIds));
    for (const r of rows) map.set(r.productId, [...(map.get(r.productId) ?? []), r]);
    return map;
  }

  offers(productId: string): Promise<OfferRow[]> {
    return this.db.select().from(offers).where(eq(offers.productId, productId)).orderBy(asc(offers.createdAt));
  }

  coaches(productId: string) {
    return this.db
      .select({ coach: coaches, link: productCoaches })
      .from(productCoaches)
      .innerJoin(coaches, eq(coaches.id, productCoaches.coachId))
      .where(eq(productCoaches.productId, productId))
      .orderBy(asc(coaches.displayName));
  }

  requirements(productId: string): Promise<RequirementRow[]> {
    return this.db.select().from(productRequirements).where(eq(productRequirements.productId, productId));
  }

  async accessPolicy(productId: string): Promise<AccessPolicyRow | null> {
    const [row] = await this.db.select().from(accessPolicies).where(eq(accessPolicies.productId, productId));
    return row ?? null;
  }

  async openIssueCount(productId: string): Promise<number> {
    const [row] = await this.db
      .select({ n: count() })
      .from(dataQualityIssues)
      .where(and(eq(dataQualityIssues.productId, productId), eq(dataQualityIssues.status, 'OPEN')));
    return row?.n ?? 0;
  }
}
