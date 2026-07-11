import { waitlistBody } from '@confirma/contracts';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { sendEmail } from '../../lib/mailer.js';
import { prisma } from '../../lib/prisma.js';
import { buildWaitlistConfirmationEmailHtml } from './functions/build-waitlist-confirmation-email.js';

export const joinWaitlist: FastifyPluginAsyncZod = async (app) => {
    app.post(
        '/waitlist',
        {
            config: {
                rateLimit: {
                    max: 5,
                    timeWindow: '1 minute',
                },
            },
            schema: {
                body: waitlistBody,
                response: {
                    200: z.object({ ok: z.literal(true) }),
                    422: z.object({ error: z.unknown() }),
                },
            },
        },

        async (request, reply) => {
            const { name, email, interest, source } = request.body;

            const { lead, isNew } = await prisma.$transaction(async (tx) => {
                const existing = await tx.waitlistLead.findUnique({ where: { email } });

                const lead = await tx.waitlistLead.upsert({
                    where: { email },
                    create: { name, email, interest, source },
                    update: { name, interest, source },
                });

                return { lead, isNew: !existing };
            });

            // Só dispara o e-mail de confirmação em cadastros novos (RF-35) —
            // reenvio no upsert geraria ruído para quem já está na lista.
            if (isNew) {
                const firstName = lead.name.trim().split(/\s+/)[0] ?? lead.name;

                await sendEmail({
                    to: lead.email,
                    subject: 'Você garantiu acesso antecipado ao Confirma',
                    html: buildWaitlistConfirmationEmailHtml(firstName),
                });
            }

            return reply.code(200).send({ ok: true });
        }
    );
};
