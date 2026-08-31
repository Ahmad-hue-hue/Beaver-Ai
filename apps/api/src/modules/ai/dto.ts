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
}

export class InsightsQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
