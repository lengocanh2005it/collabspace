import type { RunnerOptions, TaskList } from 'graphile-worker';

export type GraphileWorkerModuleOptions = Omit<
  RunnerOptions,
  'taskList' | 'taskDirectory' | 'parsedCronItems' | 'crontab' | 'crontabFile'
> & {
  disabled?: boolean;
  taskList?: TaskList;
};
