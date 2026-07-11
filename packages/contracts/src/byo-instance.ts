import { z } from "zod";

export const byoInstanceConfig = z.object({
  baseUrl: z.string().url(),
  token: z.string().min(1),
});

export type ByoInstanceConfig = z.infer<typeof byoInstanceConfig>;
