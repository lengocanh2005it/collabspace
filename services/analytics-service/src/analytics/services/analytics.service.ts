import { Injectable, NotFoundException } from '@nestjs/common';
import { AnalyticsRepository } from '../repositories/analytics.repository.js';
import type { PlatformOverviewResponseDto } from '../dto/platform-overview.dto.js';
import type { TimeseriesResponseDto } from '../dto/timeseries-query.dto.js';
import type { TimeseriesMetric } from '../../domain/timeseries-daily.schema.js';

const ZERO_SNAPSHOT: PlatformOverviewResponseDto = {
  users: { total: 0, active: 0, banned: 0, withoutWorkspace: 0, activeLast30d: 0 },
  workspaces: { total: 0, totalMembers: 0, avgMembersPerWorkspace: 0 },
  projects: { total: 0 },
  tasks: { total: 0, byStatus: { TODO: 0, DOING: 0, DONE: 0 } },
  updatedAt: new Date().toISOString(),
};

@Injectable()
export class AnalyticsService {
  constructor(private readonly repository: AnalyticsRepository) {}

  async getOverview(): Promise<PlatformOverviewResponseDto> {
    const snapshot = await this.repository.getSnapshot();

    if (!snapshot) return ZERO_SNAPSHOT;

    return {
      users: {
        total: snapshot.users?.total ?? 0,
        active: snapshot.users?.active ?? 0,
        banned: snapshot.users?.banned ?? 0,
        withoutWorkspace: snapshot.users?.withoutWorkspace ?? 0,
        activeLast30d: snapshot.users?.activeLast30d ?? 0,
      },
      workspaces: {
        total: snapshot.workspaces?.total ?? 0,
        totalMembers: snapshot.workspaces?.totalMembers ?? 0,
        avgMembersPerWorkspace: snapshot.workspaces?.avgMembersPerWorkspace ?? 0,
      },
      projects: { total: snapshot.projects?.total ?? 0 },
      tasks: {
        total: snapshot.tasks?.total ?? 0,
        byStatus: {
          TODO: snapshot.tasks?.byStatus?.TODO ?? 0,
          DOING: snapshot.tasks?.byStatus?.DOING ?? 0,
          DONE: snapshot.tasks?.byStatus?.DONE ?? 0,
        },
      },
      updatedAt: snapshot.updatedAt?.toISOString() ?? new Date().toISOString(),
    };
  }

  async getUsers(): Promise<PlatformOverviewResponseDto['users']> {
    return (await this.getOverview()).users;
  }

  async getWorkspaces(): Promise<PlatformOverviewResponseDto['workspaces']> {
    return (await this.getOverview()).workspaces;
  }

  async getTasks(): Promise<PlatformOverviewResponseDto['tasks']> {
    return (await this.getOverview()).tasks;
  }

  async getActivity(
    metric: TimeseriesMetric,
    from: string,
    to: string,
    interval: 'day',
  ): Promise<TimeseriesResponseDto> {
    const rows = await this.repository.getTimeseries(metric, from, to);

    const dataMap = new Map<string, number>(rows.map((r) => [r.date, r.value]));
    const data = eachDay(from, to).map((date) => ({ date, value: dataMap.get(date) ?? 0 }));

    return { metric, interval, from, to, data };
  }
}

function eachDay(from: string, to: string): string[] {
  const dates: string[] = [];
  const current = new Date(from);
  const end = new Date(to);

  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}
