import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class ProductSlugParamDto {
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'slug must be lower-case kebab-case' })
  @MaxLength(120)
  slug: string;
}

/** Accepts a business slug, canonical name or public alias (e.g. "VSA"). */
export class BusinessIdentifierParamDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  slug: string;
}
