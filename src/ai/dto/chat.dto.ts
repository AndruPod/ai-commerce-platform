import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, ValidateNested } from 'class-validator';
import { IsIanaTimezone } from '../../common/dto/validators';

export const MAX_MESSAGE_LENGTH = 2000;
export const MAX_HISTORY_MESSAGES = 20;
export const MAX_HISTORY_CONTENT_LENGTH = 4000;
export const MAX_CONTEXT_PRODUCTS = 5;

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class ChatHistoryMessageDto {
  @IsIn(['user', 'assistant'])
  role: 'user' | 'assistant';

  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_HISTORY_CONTENT_LENGTH)
  content: string;

  /**
   * For assistant turns: the `context.productSlugs` returned with that turn.
   * Lets follow-ups ("is it...?") resolve without server-side memory. Treated as
   * untrusted hints: format-validated here; tools still verify the product exists.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_CONTEXT_PRODUCTS)
  @Matches(SLUG, { each: true, message: 'productSlugs must contain kebab-case slugs' })
  @MaxLength(120, { each: true })
  productSlugs?: string[];
}

export class ChatRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_MESSAGE_LENGTH)
  message: string;

  @IsOptional()
  @IsIanaTimezone()
  timezone?: string;

  /** Optional client-held history; nothing is persisted server-side. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_HISTORY_MESSAGES)
  @ValidateNested({ each: true })
  @Type(() => ChatHistoryMessageDto)
  history?: ChatHistoryMessageDto[];
}
