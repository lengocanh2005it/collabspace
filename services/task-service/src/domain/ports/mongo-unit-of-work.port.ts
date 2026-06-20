import type { ClientSession } from "mongoose";

export const MONGO_UNIT_OF_WORK = Symbol("MONGO_UNIT_OF_WORK");

export interface IMongoUnitOfWork {
  run<T>(work: (session: ClientSession) => Promise<T>): Promise<T>;
}
