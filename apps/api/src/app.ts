import Fastify from 'fastify';
import {
    serializerCompiler,
    validatorCompiler,
    type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { loggerOptions } from './lib/logger.js';
import { waitlistRoutes } from './modules/waitlist/index.js';
import { registerCors } from './plugins/cors.js';
import { registerErrorHandler } from './plugins/error-handler.js';
import { registerPrisma } from './plugins/prisma.js';
import { registerRateLimit } from './plugins/rate-limit.js';
import { registerSwagger } from './plugins/swagger.js';

export async function buildApp() {
    const app = Fastify({ logger: loggerOptions }).withTypeProvider<ZodTypeProvider>();

    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);

    await registerErrorHandler(app);
    await registerCors(app);
    await registerRateLimit(app);
    await registerSwagger(app);
    await registerPrisma(app);

    app.get('/health', async () => ({ ok: true }));

    await app.register(waitlistRoutes);

    return app;
}
