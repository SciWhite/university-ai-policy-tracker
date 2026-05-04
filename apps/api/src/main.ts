import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { AppModule } from "./app.module.js";

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter()
  );

  app.enableCors({
    origin: process.env.WEB_PUBLIC_BASE_URL || true
  });

  const port = Number(process.env.PORT || 4000);
  await app.listen(port, "0.0.0.0");
}

void bootstrap();
