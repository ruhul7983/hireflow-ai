// src/common/pagination.ts
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MAX_SEARCH_LENGTH = 100;

export class PageQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  pageSize = DEFAULT_PAGE_SIZE;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  )
  @IsString()
  @MaxLength(MAX_SEARCH_LENGTH)
  search?: string;
}

export class JobPageQueryDto extends PageQueryDto {
  @IsOptional()
  @IsUUID()
  jobId?: string;
}

// Escaped so a search for "100%" means those characters, not a wildcard
export function containsText(search: string) {
  return {
    contains: search.replace(/[\\%_]/g, '\\$&'),
    mode: 'insensitive' as const,
  };
}

// A page past the end lands on the last page, because filters and deletes shrink lists
export async function paginate<T>(
  { page, pageSize }: PageQueryDto,
  total: number,
  load: (range: { skip: number; take: number }) => PromiseLike<T[]>,
) {
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  const current = Math.min(page, totalPages);
  const items = await load({
    skip: (current - 1) * pageSize,
    take: pageSize,
  });

  return { items, page: current, pageSize, total, totalPages };
}
