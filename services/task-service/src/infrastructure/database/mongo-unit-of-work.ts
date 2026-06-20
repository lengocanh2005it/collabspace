import { Injectable } from "@nestjs/common";
import { InjectConnection } from "@nestjs/mongoose";
import type { Connection } from "mongoose";
import type { IMongoUnitOfWork } from "../../domain/ports/mongo-unit-of-work.port";

@Injectable()
export class MongoUnitOfWork implements IMongoUnitOfWork {
  constructor(
    @InjectConnection()
    private readonly connection: Connection,
  ) {}

  async run<T>(work: (session: import("mongoose").ClientSession) => Promise<T>): Promise<T> {
    const session = await this.connection.startSession();

    try {
      let result!: T;
      await session.withTransaction(async () => {
        result = await work(session);
      });
      return result;
    } finally {
      await session.endSession();
    }
  }
}
