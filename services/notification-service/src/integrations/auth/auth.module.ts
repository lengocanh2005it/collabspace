import { Module } from "@nestjs/common";
import { ClientsModule, Transport } from "@nestjs/microservices";
import { join } from "node:path";
import { AUTH_GRPC_CLIENT, AuthGrpcService } from "./auth-grpc.service";

const protoDir = join(process.cwd(), "proto");

@Module({
  imports: [
    ClientsModule.register([
      {
        name: AUTH_GRPC_CLIENT,
        options: {
          loader: {
            arrays: true,
            enums: String,
            includeDirs: [protoDir],
            keepCase: false,
            objects: true,
            oneofs: true,
          },
          package: "auth",
          protoPath: [join(protoDir, "auth.proto")],
          url: process.env.AUTH_SERVICE_GRPC_URL ?? "auth-service:50051",
        },
        transport: Transport.GRPC,
      },
    ]),
  ],
  providers: [AuthGrpcService],
  exports: [AuthGrpcService],
})
export class AuthModule {}
