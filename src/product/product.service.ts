import { Injectable, NotFoundException } from '@nestjs/common';
import { BusinessRepository } from '../business/business.repository';
import { toProvenance } from '../common/provenance/provenance';
import { ProductListQueryDto } from './dto/product-query.dto';
import { ProductDetailDto, ProductListResponseDto } from './dto/product.response';
import { toAccessPolicy, toOffer, toProductSummary, toRequirements } from './product.mapper';
import { ProductRepository, ProductWithBusiness } from './product.repository';

@Injectable()
export class ProductService {
  constructor(
    private readonly repo: ProductRepository,
    private readonly businesses: BusinessRepository,
  ) {}

  /** Used by every product sub-resource: resolves the product or throws 404. */
  async getContextOrThrow(slug: string): Promise<ProductWithBusiness> {
    const row = await this.repo.findBySlug(slug);
    if (!row) throw new NotFoundException(`Product "${slug}" not found`);
    return row;
  }

  async list(q: ProductListQueryDto): Promise<ProductListResponseDto> {
    const appliedFilters = Object.fromEntries(Object.entries(q).filter(([, v]) => v !== undefined)) as Record<string, string | number>;

    let businessResolution: ProductListResponseDto['businessResolution'] = null;
    let businessId: string | undefined;
    if (q.business) {
      const match = await this.businesses.resolve(q.business);
      businessResolution = {
        requested: q.business,
        matchedBusinessSlug: match?.business.slug ?? null,
        matchedBy: match?.matchedBy ?? null,
        matchedValue: match?.matchedValue ?? null,
      };
      if (!match) return { items: [], businessResolution, appliedFilters };
      businessId = match.business.id;
    }

    const rows = await this.repo.list({ ...q, businessId });
    const [aliases, audience] = await Promise.all([
      this.businesses.aliasesFor([...new Set(rows.map((r) => r.business.id))]),
      this.repo.audienceLevels(rows.map((r) => r.product.id)),
    ]);
    return {
      items: rows.map((r) => toProductSummary(r, aliases.get(r.business.id) ?? [], audience.get(r.product.id) ?? [])),
      businessResolution,
      appliedFilters,
    };
  }

  async detail(slug: string): Promise<ProductDetailDto> {
    const row = await this.getContextOrThrow(slug);
    const id = row.product.id;
    const [aliases, audience, offers, coaches, requirements, access, openIssues] = await Promise.all([
      this.businesses.aliasesFor([row.business.id]),
      this.repo.audienceLevels([id]),
      this.repo.offers(id),
      this.repo.coaches(id),
      this.repo.requirements(id),
      this.repo.accessPolicy(id),
      this.repo.openIssueCount(id),
    ]);
    const audienceRows = audience.get(id) ?? [];
    const base = `/products/${row.product.slug}`;

    return {
      ...toProductSummary(row, aliases.get(row.business.id) ?? [], audienceRows),
      description: row.product.description,
      audience: audienceRows.map((a) => ({ level: a.level, provenance: toProvenance(a) })),
      offers: offers.map(toOffer),
      program: row.program
        ? {
            durationMonths: row.program.durationMonths,
            includedClasses: row.program.includedClassCount,
            classDurationMinutes: row.program.classDurationMinutes,
            provenance: toProvenance(row.program),
          }
        : null,
      coaches: coaches.map(({ coach, link }) => ({ displayName: coach.displayName, role: link.role, provenance: toProvenance(link) })),
      accessPolicy: access ? toAccessPolicy(access) : null,
      requirements: toRequirements(requirements),
      openDataQualityIssues: openIssues,
      links: {
        schedule: `${base}/schedule`,
        enrollment: `${base}/enrollment`,
        checkout: `${base}/checkout`,
        dataQuality: `${base}/data-quality`,
        dateCheck: `${base}/date-check?date=YYYY-MM-DD`,
      },
    };
  }
}
