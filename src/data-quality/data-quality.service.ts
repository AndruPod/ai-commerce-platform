import { Injectable } from '@nestjs/common';
import { ProductRepository } from '../product/product.repository';
import { ProductService } from '../product/product.service';
import { DataQualityRepository, DataQualityIssueRow } from './data-quality.repository';
import { buildIssueEvidence, EvidenceContext } from './domain/issue-evidence';
import { DataQualityIssueDto, DataQualityResponseDto } from './dto/data-quality.response';

@Injectable()
export class DataQualityService {
  constructor(
    private readonly repo: DataQualityRepository,
    private readonly products: ProductService,
    private readonly productRepo: ProductRepository,
  ) {}

  async getForSlug(slug: string): Promise<DataQualityResponseDto> {
    const ctx = await this.products.getContextOrThrow(slug);
    const [issues, offers, checkoutObservation] = await Promise.all([
      this.repo.findByProductId(ctx.product.id),
      this.productRepo.offers(ctx.product.id),
      this.repo.checkoutObservation(ctx.product.id),
    ]);
    const offer = offers[0];
    const evidenceCtx: EvidenceContext = {
      offer: offer ? { amountMinor: offer.amountMinor, currency: offer.currency, pricingBasis: offer.pricingBasis, sourceType: offer.sourceType } : null,
      program: ctx.program ? { includedClassCount: ctx.program.includedClassCount } : null,
      checkoutObservation,
    };
    const open = issues.filter((i) => i.status === 'OPEN');
    const byType: DataQualityResponseDto['summary']['byType'] = {};
    for (const i of open) byType[i.issueType] = (byType[i.issueType] ?? 0) + 1;

    return {
      product: { slug: ctx.product.slug, name: ctx.product.name },
      summary: { open: open.length, byType },
      issues: issues.map((i) => toIssueDto(i, evidenceCtx)),
      note: 'Raw claims listed here are NOT authoritative commerce data. DERIVED values are computed by this system for comparison only and are not published business facts.',
    };
  }
}

export function toIssueDto(i: DataQualityIssueRow, ctx: EvidenceContext): DataQualityIssueDto {
  return {
    fieldPath: i.fieldPath,
    rawClaim: i.rawClaim,
    claimSource: { sourceType: i.claimSourceType, sourceRef: i.claimSourceRef, capturedAt: i.capturedAt?.toISOString() ?? null },
    issueType: i.issueType,
    status: i.status,
    blocksCheckout: i.status === 'OPEN' ? i.blockingCode : null,
    explanation: i.explanation,
    evidence: buildIssueEvidence(i, ctx),
    exposedAsCommerceData: false,
  };
}
