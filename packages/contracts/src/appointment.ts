import { z } from "zod";

export const createAppointmentBody = z.object({
  externalId: z.string().min(1),
  patient: z.object({
    name: z.string().min(1),
    phone: z.string().regex(/^\+[1-9]\d{7,14}$/), // E.164
  }),
  appointment: z.object({
    type: z.string().min(1),
    datetime: z.string().datetime({ offset: true }),
    location: z.string().optional(),
    professional: z.string().optional(),
  }),
  notification: z
    .object({
      channels: z.array(z.enum(["whatsapp"])).default(["whatsapp"]),
      reminderOffsets: z.array(z.string().regex(/^\d+[hm]$/)).optional(),
    })
    .optional(),
  callbackUrl: z.string().url().optional(),
});

export type CreateAppointmentBody = z.infer<typeof createAppointmentBody>;
