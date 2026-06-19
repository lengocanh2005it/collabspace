export type TransactionContext = {
  manager: unknown;
};

export interface IUnitOfWork {
  run<T>(work: (context: TransactionContext) => Promise<T>): Promise<T>;
}

export const UNIT_OF_WORK = Symbol('UNIT_OF_WORK');
