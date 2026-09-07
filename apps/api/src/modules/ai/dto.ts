import { IsArray, IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';

import { Type } from 'class-transformer';

export class AiChatMessage {
  @IsString()
  @MaxLength(4000)
  content!: string;

  /** Optional base64 image data URLs to attach to this message (vision). */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];
}

export class AiChatDto {
  /** Conversation turns; the last one is the user's newest question. */
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AiChatMessage)
  messages!: AiChatMessage[];

  /**
   * Private thread to continue. When set, history is loaded server-side from
   * the caller's own conversation (ownership enforced) and this turn is
   * persisted; client-supplied `messages` are then ignored.
   */
  @IsOptional()
  @IsString()
  conversationId?: string;
}

export class CreateConversationDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  title?: string;
}

export class InsightsQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
