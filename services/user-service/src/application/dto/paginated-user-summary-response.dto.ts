import { UserSummaryResponseDto } from './user-summary-response.dto';

export type PaginatedUserSummaryResponseDto = {
  items: UserSummaryResponseDto[];
  limit: number;
  offset: number;
  total: number;
};
