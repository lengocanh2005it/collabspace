import { DataSource } from 'typeorm';
import { DatabaseService } from './database.service';

describe('DatabaseService', () => {
  const dataSourceMock = {
    destroy: jest.fn(),
    initialize: jest.fn(),
    isInitialized: false,
    query: jest.fn(),
  } as unknown as DataSource;

  let databaseService: DatabaseService;

  beforeEach(() => {
    jest.clearAllMocks();
    dataSourceMock.isInitialized = false;
    databaseService = new DatabaseService(dataSourceMock);
  });

  it('initializes the datasource once', async () => {
    (dataSourceMock.initialize as jest.Mock).mockResolvedValue(dataSourceMock);

    await expect(databaseService.initialize()).resolves.toBe(dataSourceMock);
    expect(dataSourceMock.initialize).toHaveBeenCalledTimes(1);
  });

  it('does not destroy an uninitialized datasource', async () => {
    await databaseService.destroy();

    expect(dataSourceMock.destroy).not.toHaveBeenCalled();
  });

  it('pings only when initialized', async () => {
    await expect(databaseService.ping()).resolves.toBe(false);

    dataSourceMock.isInitialized = true;
    (dataSourceMock.query as jest.Mock).mockResolvedValue([{ '?column?': 1 }]);

    await expect(databaseService.ping()).resolves.toBe(true);
    expect(dataSourceMock.query).toHaveBeenCalledWith('SELECT 1');
  });
});
