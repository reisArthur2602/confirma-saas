import cors from "@fastify/cors";
import { env } from "@confirma/env";
import type { FastifyInstance } from "fastify";

export async function registerCors(app: FastifyInstance) {
  await app.register(cors, {
    origin: env.CORS_ORIGIN === "*" ? true : env.CORS_ORIGIN.split(","),
    
  });
}
