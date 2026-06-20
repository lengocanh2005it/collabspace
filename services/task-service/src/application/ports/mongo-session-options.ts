import type { ClientSession } from "mongoose";

export type MongoSessionOptions = {
  session?: ClientSession;
};
