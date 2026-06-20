import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminUserId, PlatformAdminGuard, RequirePermission } from '@collabspace/nest-auth';
import { DlqReplayService } from '../../application/dlq-replay.service';
import { ReplayDlqMessageDto } from '../dto/replay-dlq-message.dto';
import { ReplayBatchDlqDto } from '../dto/replay-batch-dlq.dto';
import { ResolveDiscardDlqDto } from '../dto/resolve-discard-dlq.dto';
import { DlqMessageResponseDto } from '../dto/dlq-message-response.dto';
import type { DlqRecord } from '../../domain/dlq-record.schema';

@ApiTags('dlq-actions')
@ApiBearerAuth()
@UseGuards(PlatformAdminGuard)
@RequirePermission('dlq.manage')
@Controller('dlq')
export class DlqActionsController {
  constructor(private readonly replayService: DlqReplayService) {}

  @Post('messages/:id/replay')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually replay a single DLQ record back to its source topic' })
  async replayOne(
    @Param('id') id: string,
    @Body() _body: ReplayDlqMessageDto,
    @AdminUserId() adminUserId: string,
  ): Promise<DlqMessageResponseDto> {
    const record = await this.replayService.replayOne(id, adminUserId);
    return DlqMessageResponseDto.fromDocument(
      record as DlqRecord & { _id: { toString(): string } },
    );
  }

  @Post('replay-batch')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Batch replay DLQ records matching optional filters (max 50)' })
  async replayBatch(@Body() body: ReplayBatchDlqDto, @AdminUserId() adminUserId: string) {
    const hasIds = Boolean(body.ids?.length);
    const hasFilter = Boolean(body.sourceTopic || body.errorCategory || body.status?.length);
    if (hasIds && hasFilter) {
      throw new BadRequestException('Use either ids or filter, not both.');
    }

    const outcomes = hasIds
      ? await this.replayService.replayManyByIds(body.ids ?? [], adminUserId)
      : await this.replayService.replayBatch(
          {
            sourceTopic: body.sourceTopic,
            errorCategory: body.errorCategory,
            statuses: body.status,
            limit: body.limit,
          },
          adminUserId,
        );

    return {
      total: outcomes.length,
      produced: outcomes.filter((o) => o.produced).length,
      skipped: outcomes.filter((o) => o.skipped).length,
      results: outcomes.map((o) => ({
        id: o.id ?? (o.record as DlqRecord & { _id: { toString(): string } })._id.toString(),
        produced: o.produced,
        skipped: o.skipped,
        reason: o.reason,
      })),
    };
  }

  @Post('messages/:id/resolve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a DLQ record as resolved (admin confirmed handling)' })
  async resolveOne(
    @Param('id') id: string,
    @Body() body: ResolveDiscardDlqDto,
    @AdminUserId() adminUserId: string,
  ): Promise<DlqMessageResponseDto> {
    const record = await this.replayService.resolveOne(id, adminUserId, body.resolutionNote);
    return DlqMessageResponseDto.fromDocument(
      record as DlqRecord & { _id: { toString(): string } },
    );
  }

  @Post('messages/:id/discard')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Discard a DLQ record — will not be replayed' })
  async discardOne(
    @Param('id') id: string,
    @Body() body: ResolveDiscardDlqDto,
    @AdminUserId() adminUserId: string,
  ): Promise<DlqMessageResponseDto> {
    const record = await this.replayService.discardOne(id, adminUserId, body.resolutionNote);
    return DlqMessageResponseDto.fromDocument(
      record as DlqRecord & { _id: { toString(): string } },
    );
  }
}
