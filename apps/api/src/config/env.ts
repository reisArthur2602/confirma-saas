import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  CORS_ORIGIN: z.string().default("*"),
  DATABASE_URL: z.string().url(),
  RESEND_API_KEY: z.string(),
  MAIL_FROM: z.string().default("Confirma <no-reply@useconfirma.com.br>"),
});

export const env = envSchema.parse(process.env);
