import { Injectable, NotFoundException } from '@nestjs/common';
import { BusinessRepository } from './business.repository';
import { BusinessResponseDto } from './dto/business.response';

@Injectable()
export class BusinessService {
  constructor(private readonly repo: BusinessRepository) {}

  async get(identifier: string): Promise<BusinessResponseDto> {
    const match = await this.repo.resolve(identifier);
    if (!match) throw new NotFoundException(`Business "${identifier}" not found`);
    const { business } = match;
    const [aliases, products] = await Promise.all([this.repo.aliasesFor([business.id]), this.repo.productRefs(business.id)]);
    return {
      slug: business.slug,
      canonicalName: business.canonicalName,
      aliases: aliases.get(business.id) ?? [],
      resolution: { requested: identifier, matchedBy: match.matchedBy, matchedValue: match.matchedValue },
      products,
    };
  }
}
