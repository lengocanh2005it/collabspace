import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { HealthController } from '../src/presentation/http/health.controller';
import { WorkspaceHealthService } from '../src/health/workspace-health.service';
import { MetricsService } from '../src/metrics/metrics.service';

describe('WorkspaceService health (e2e)', () => {
  let app: INestApplication<App>;

  const workspaceHealthServiceMock = {
    getLiveness: jest.fn(),
    getReadiness: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    workspaceHealthServiceMock.getLiveness.mockReturnValue({
      service: 'workspace-service',
      status: 'ok',
      timestamp: '2026-05-11T00:00:00.000Z',
      uptimeSeconds: 12,
    });
    workspaceHealthServiceMock.getReadiness.mockResolvedValue({
      checks: {
        database: {
          required: true,
          responseTimeMs: 2,
          status: 'up',
        },
      },
      mode: 'full',
      ready: true,
      service: 'workspace-service',
      status: 'ok',
      timestamp: '2026-05-11T00:00:00.000Z',
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: WorkspaceHealthService,
          useValue: workspaceHealthServiceMock,
        },
        {
          provide: MetricsService,
          useValue: {
            contentType: 'text/plain',
            getMetrics: jest.fn().mockResolvedValue(''),
          },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
  });

  it('/workspaces/health/live (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/v1/workspaces/health/live')
      .expect(200)
      .expect((response) => {
        expect(response.body.status).toBe('ok');
        expect(response.body.service).toBe('workspace-service');
      });
  });

  it('/workspaces/health/ready (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/v1/workspaces/health/ready')
      .expect(200)
      .expect((response) => {
        expect(response.body.ready).toBe(true);
        expect(response.body.status).toBe('ok');
      });
  });
});
