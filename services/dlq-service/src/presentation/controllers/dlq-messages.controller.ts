import { Controller, Get, NotFoundException, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PlatformAdminGuard, RequirePermission } from '@collabspace/nest-auth';
import { Inject } from '@nestjs/common';
import {
  DLQ_RECORD_REPOSITORY,
  type IDlqRecordRepository,
} from '../../domain/dlq-record.repository';
import { ListDlqMessagesQueryDto } from '../dto/list-dlq-messages-query.dto';
import { DlqMessageResponseDto, ListDlqMessagesResponseDto } from '../dto/dlq-message-response.dto';
import type { DlqRecord } from '../../domain/dlq-record.schema';

@ApiTags('dlq-messages')
@ApiBearerAuth()
@UseGuards(PlatformAdminGuard)
@RequirePermission('dlq.read')
@Controller('dlq/messages')
export class DlqMessagesController {
  constructor(@Inject(DLQ_RECORD_REPOSITORY) private readonly repo: IDlqRecordRepository) {}

  @Get()
  @ApiOperation({ summary: 'List DLQ messages with optional filters and cursor pagination' })
  async list(@Query() query: ListDlqMessagesQueryDto): Promise<ListDlqMessagesResponseDto> {
    const result = await this.repo.list({
      status: query.status,
      errorCategory: query.errorCategory,
      sourceTopic: query.sourceTopic,
      cursor: query.cursor,
      limit: query.limit,
    });

    return {
      data: result.records.map((r) =>
        DlqMessageResponseDto.fromDocument(r as DlqRecord & { _id: { toString(): string } }),
      ),
      nextCursor: result.nextCursor,
      total: result.total,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single DLQ message by ID' })
  async findOne(@Param('id') id: string): Promise<DlqMessageResponseDto> {
    const record = await this.repo.findById(id);
    if (!record) throw new NotFoundException(`DLQ record not found: ${id}`);
    return DlqMessageResponseDto.fromDocument(
      record as DlqRecord & { _id: { toString(): string } },
    );
  }
}
