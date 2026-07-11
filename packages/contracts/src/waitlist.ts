import { z } from "zod";

export const waitlistBody = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  interest: z
    .enum(["reduzir_faltas", "nao_construir_fila", "byo", "documentacao", "outro"])
    .optional(),
  source: z.enum(["linkedin", "indicacao", "comunidade", "outro"]).optional(),
  // honeypot: campo invisível via CSS; humano nunca preenche, bot preenche.
  website: z.string().max(0).optional(),
});

export type WaitlistBody = z.infer<typeof waitlistBody>;
