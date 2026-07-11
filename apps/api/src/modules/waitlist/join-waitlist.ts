import { ConflictError } from '@/lib/errors.js';
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
                },
            },
        },

        async (request, reply) => {
            const { name, email, interest, source } = request.body;

            const existing = await prisma.waitlistLead.findUnique({ where: { email } });

            if (existing) throw new ConflictError('Este e-mail já está na lista de espera.');

            const lead = await prisma.waitlistLead.create({
                data: { name, email, interest, source },
            });

            const firstName = lead.name.trim().split(/\s+/)[0] ?? lead.name;

            await sendEmail({
                to: lead.email,
                subject: 'Você garantiu acesso antecipado ao Confirma',
                html: buildWaitlistConfirmationEmailHtml(firstName),
            });

            return reply.code(200).send({ ok: true });
        }
    );
};
