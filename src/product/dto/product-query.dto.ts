import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { DELIVERY_MODES, DeliveryMode, DISCIPLINES, Discipline, EXPERIENCE_LEVELS, ExperienceLevel } from '../../common/enums';

const upper = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() : value);

export class ProductListQueryDto {
  /** Business slug, canonical name or alias ("VSA", "Victory Skating"). */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  business?: string;

  @IsOptional()
  @Transform(upper)
  @IsIn(DISCIPLINES)
  discipline?: Discipline;

  @IsOptional()
  @Transform(upper)
  @IsIn(DELIVERY_MODES)
  deliveryMode?: DeliveryMode;

  @IsOptional()
  @Transform(upper)
  @IsIn(EXPERIENCE_LEVELS)
  level?: ExperienceLevel;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(120)
  durationMonths?: number;

  /** Case-insensitive substring match on product name/description and business names/aliases. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  q?: string;
}
