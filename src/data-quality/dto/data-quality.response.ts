import type { DataQualityIssueStatus, DataQualityIssueType, SourceType, TransactionBlockCode } from '../../common/enums';
import type { IssueEvidence } from '../domain/issue-evidence';

export interface DataQualityIssueDto {
  fieldPath: string;
  rawClaim: string | null;
  claimSource: { sourceType: SourceType | null; sourceRef: string | null; capturedAt: string | null };
  issueType: DataQualityIssueType;
  status: DataQualityIssueStatus;
  /** Set while this OPEN issue blocks the product's checkout action. */
  blocksCheckout: TransactionBlockCode | null;
  explanation: string;
  evidence: IssueEvidence;
  /** Always false: raw claims here are never authoritative commerce data. */
  exposedAsCommerceData: false;
}

export interface DataQualityResponseDto {
  product: { slug: string; name: string };
  summary: { open: number; byType: Partial<Record<DataQualityIssueType, number>> };
  issues: DataQualityIssueDto[];
  note: string;
}
