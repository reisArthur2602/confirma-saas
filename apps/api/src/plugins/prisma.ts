import { prisma } from '@/lib/prisma.js';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { PrismaClient } from '../generated/prisma/client.js';

declare module 'fastify' {
    interface FastifyInstance {
        prisma: PrismaClient;
    }
}

export const registerPrisma = fp(async (app: FastifyInstance) => {
    await prisma.$connect();

    app.decorate('prisma', prisma);

    app.addHook('onClose', async (instance) => {
        await instance.prisma.$disconnect();
    });
});
