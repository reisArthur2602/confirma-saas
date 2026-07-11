import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  hasZodFastifySchemaValidationErrors,
  isResponseSerializationError,
} from "fastify-type-provider-zod";
import { HttpError } from "../lib/errors.js";

type ErrorBody = {
  error: string;
  code: string;
  message: string;
  details?: unknown;
};

export async function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, request: FastifyRequest, reply: FastifyReply) => {
    // Payload não bate com o schema Zod da rota (body/query/params inválidos).
    if (hasZodFastifySchemaValidationErrors(error)) {
      const body: ErrorBody = {
        error: "Bad Request",
        code: "VALIDATION_ERROR",
        message: "Payload inválido.",
        details: error.validation,
      };
      return reply.code(400).send(body);
    }

    // Resposta gerada pela rota não bate com o schema de output — bug interno, não do cliente.
    if (isResponseSerializationError(error)) {
      request.log.error({ err: error }, "Response serialization error");
      const body: ErrorBody = {
        error: "Internal Server Error",
        code: "INTERNAL_SERVER_ERROR",
        message: "Erro interno ao processar a resposta.",
      };
      return reply.code(500).send(body);
    }

    // Erros de domínio explícitos (BadRequestError, UnauthorizedError, etc.).
    if (error instanceof HttpError) {
      const body: ErrorBody = {
        error: error.name,
        code: error.code,
        message: error.message,
      };
      return reply.code(error.statusCode).send(body);
    }

    // Erros nativos do Fastify (ex.: rate limit, body malformado) já trazem statusCode.
    const fastifyError = error as FastifyError;
    const statusCode =
      typeof fastifyError.statusCode === "number" ? fastifyError.statusCode : 500;

    if (statusCode < 500) {
      const body: ErrorBody = {
        error: fastifyError.name || "Bad Request",
        code: "REQUEST_ERROR",
        message: fastifyError.message,
      };
      return reply.code(statusCode).send(body);
    }

    // Qualquer coisa não mapeada é 500 — logamos o detalhe, mas nunca vaza pro cliente.
    request.log.error({ err: error }, "Unhandled error");
    const body: ErrorBody = {
      error: "Internal Server Error",
      code: "INTERNAL_SERVER_ERROR",
      message: "Erro interno do servidor.",
    };
    return reply.code(500).send(body);
  });

  app.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) => {
    const body: ErrorBody = {
      error: "Not Found",
      code: "NOT_FOUND",
      message: `Rota ${request.method}:${request.url} não encontrada.`,
    };
    return reply.code(404).send(body);
  });
}
