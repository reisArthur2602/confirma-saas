import scalarApiReference from "@scalar/fastify-api-reference";
import swagger from "@fastify/swagger";
import type { FastifyInstance } from "fastify";
import { jsonSchemaTransform } from "fastify-type-provider-zod";

export async function registerSwagger(app: FastifyInstance) {
  await app.register(swagger, {
    openapi: {
      info: {
        title: "Confirma API",
        description: "Infraestrutura de confirmação de agenda via WhatsApp.",
        version: "1.0.0",
      },
    },
    transform: jsonSchemaTransform,
  });

  await app.register(scalarApiReference, {
    routePrefix: "/docs",
  });
}
