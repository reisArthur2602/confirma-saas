import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { joinWaitlist } from './join-waitlist.js';

export const waitlistRoutes: FastifyPluginAsyncZod = async (app) => {
    await app.register(joinWaitlist);
};
