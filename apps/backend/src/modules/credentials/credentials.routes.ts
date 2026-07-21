import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { CredentialController } from './credentials.controller';
import { CredentialService } from './credentials.service';

import {
    createCredentialSchema,
    updateCredentialSchema,
    listCredentialsQuerySchema,
    validateCredentialSchema
} from './credentials.schema';
import { authenticate } from '../../shared/middleware/auth';
import { getClient } from '../../providers/db';

const credentialsRouter = new Hono();

// Initialize dependencies
const prisma = getClient();
const masterKey = process.env.ENCRYPTION_MASTER_KEY || '';
const credentialService = new CredentialService(prisma, masterKey);
const credentialController = new CredentialController(credentialService);

// ============== PROTECTED ROUTES ==============
credentialsRouter.use('*', authenticate);

// ============== CRUD OPERATIONS ==============

/**
 * GET /credentials
 * List all credentials for the authenticated merchant
 * Query params: provider, mode, status (optional filters)
 */
credentialsRouter.get('/', zValidator('query', listCredentialsQuerySchema), async (c) =>
    credentialController.getCredentials(c)
);

/**
 * POST /credentials
 * Create a new credential
 */
credentialsRouter.post('/', zValidator('json', createCredentialSchema), async (c) =>
    credentialController.createCredential(c)
);

/**
 * GET /credentials/:id
 * Get a specific credential by ID
 */
credentialsRouter.get('/:id', async (c) => credentialController.getCredential(c));

/**
 * PATCH /credentials/:id
 * Update a credential
 */
credentialsRouter.patch('/:id', zValidator('json', updateCredentialSchema), async (c) =>
    credentialController.updateCredential(c)
);

/**
 * DELETE /credentials/:id
 * Delete a credential
 */
credentialsRouter.delete('/:id', async (c) => credentialController.deleteCredential(c));

// ============== CREDENTIAL ACTIONS ==============

/**
 * POST /credentials/:id/validate
 * Validate a credential against the provider
 */
credentialsRouter.post('/:id/validate', async (c) => credentialController.validateCredential(c));

/**
 * POST /credentials/:id/toggle
 * Toggle credential active/disabled
 * Body: { active: boolean }
 */
credentialsRouter.post(
    '/:id/toggle',
    zValidator(
        'json',
        (await import('zod')).object({
            active: (await import('zod')).z.boolean()
        })
    ),
    async (c) => credentialController.toggleCredential(c)
);

export { credentialsRouter };
