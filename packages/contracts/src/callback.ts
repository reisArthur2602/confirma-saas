import { z } from "zod";

export const callbackEvent = z.enum([
  "appointment.confirmed",
  "appointment.cancelled",
  "appointment.reschedule_requested",
  "appointment.no_response",
  "appointment.delivery_failed",
]);

export const errorCategory = z.enum(["client_instance_error", "confirma_internal_error"]);

export const callbackBody = z.object({
  event: callbackEvent,
  appointmentId: z.string().min(1),
  externalId: z.string().min(1),
  status: z.string().min(1),
  respondedAt: z.string().datetime({ offset: true }).optional(),
  raw: z
    .object({
      reply: z.string().optional(),
      errorCategory: errorCategory.optional(),
    })
    .catchall(z.unknown())
    .optional(),
});

export type CallbackEvent = z.infer<typeof callbackEvent>;
export type ErrorCategory = z.infer<typeof errorCategory>;
export type CallbackBody = z.infer<typeof callbackBody>;
