import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.coerce.number().int().positive().default(3000),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
    CORS_ORIGIN: z.string().default("*"),

    DATABASE_URL: z.string().url(),

    RESEND_API_KEY: z.string(),
    MAIL_FROM: z.string().default("Equipe Confirma <suporte@useconfirma.com.br>"),
  },
  client: {
    NEXT_PUBLIC_API_URL: z.string().url(),
  },
  clientPrefix: "NEXT_PUBLIC_",
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
