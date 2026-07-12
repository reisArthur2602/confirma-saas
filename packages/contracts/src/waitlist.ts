import { z } from 'zod';

export const waitlistBody = z.object({
    name: z.string().min(1),
    email: z.string().email(),
    interest: z
        .enum(['reduzir_faltas', 'nao_construir_fila', 'byo', 'documentacao', 'outro'])
        .default('reduzir_faltas'),
    source: z.enum(['linkedin', 'indicacao', 'comunidade', 'outro']).default('linkedin'),

    website: z.string().optional(),
});

export type WaitlistBody = z.infer<typeof waitlistBody>;
