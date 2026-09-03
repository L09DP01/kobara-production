import { OpenApiGeneratorV3, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import {
  PaymentCreatePayloadSchema,
  PaymentResponseSchema,
  WithdrawalCreatePayloadSchema,
  WithdrawalResponseSchema,
} from './validators';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';

export function generateOpenAPI() {
  const registry = new OpenAPIRegistry();

  registry.registerComponent('securitySchemes', 'BearerAuth', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'Kobara API key',
  });
  
  registry.registerPath({
    path: '/v1/payments',
    method: 'post',
    summary: 'Create a new payment',
    description: 'Initialize a payment transaction. Use provider "moncash", "natcash", "card", "paypal", "apple_pay", or "google_pay" to preselect a method. Use "kobara" (default) for the unified checkout page where the customer chooses. International payment data is collected only on the hosted Kobara checkout.',
    tags: ['Payments'],
    security: [{ BearerAuth: [] }],
    request: {
      headers: z.object({
        'Idempotency-Key': z.string().min(1).openapi({
          param: {
            name: 'Idempotency-Key',
            in: 'header',
          },
          description: 'Unique key for this payment attempt. Reuse it only when retrying the exact same request.',
          example: '8f3d4e2a-93c2-4c0f-bbe0-95ab31f6d712',
        }),
      }),
      body: {
        content: {
          'application/json': {
            schema: PaymentCreatePayloadSchema,
          },
        },
      },
    },
    responses: {
      '200': {
        description: 'Payment successfully initialized',
        content: {
          'application/json': {
            schema: PaymentResponseSchema,
          },
        },
      },
      '400': {
        description: 'Bad request (Validation error)'
      },
      '401': {
        description: 'Unauthorized'
      }
    },
  });

  registry.registerPath({
    path: '/v1/withdrawals',
    method: 'post',
    summary: 'Create a MonCash or NatCash withdrawal',
    description: 'Debit a merchant HTG or USD balance and send the net amount, after fees and any currency conversion, to a Haitian mobile wallet.',
    tags: ['Withdrawals'],
    security: [{ BearerAuth: [] }],
    request: {
      headers: z.object({
        'Idempotency-Key': z.string().min(1).max(255).openapi({
          param: { name: 'Idempotency-Key', in: 'header' },
          description: 'Unique key for this withdrawal. Reuse it only when retrying the exact same request.',
          example: 'withdrawal-8f3d4e2a-93c2-4c0f-bbe0-95ab31f6d712',
        }),
      }),
      body: { content: { 'application/json': { schema: WithdrawalCreatePayloadSchema } } },
    },
    responses: {
      '200': { description: 'Withdrawal completed', content: { 'application/json': { schema: WithdrawalResponseSchema } } },
      '202': { description: 'Withdrawal accepted and pending confirmation' },
      '400': { description: 'Invalid request or missing idempotency key' },
      '401': { description: 'Invalid or missing secret API key' },
      '403': { description: 'Merchant, plan, KYC, or USD account does not allow the withdrawal' },
      '409': { description: 'Insufficient available funds, funds pending release, or idempotency conflict' },
      '429': { description: 'Rate limit exceeded' },
      '502': { description: 'Provider rejected the transfer; reserved funds were refunded' },
    },
  });

  const generator = new OpenApiGeneratorV3(registry.definitions);

  const document = generator.generateDocument({
    openapi: '3.0.0',
    info: {
      version: '1.0.0',
      title: 'Kobara API',
      description: 'The Kobara API for unified local and international payments, plus MonCash and NatCash withdrawals.',
    },
    servers: [{ url: 'https://api.kobara.app' }],
  });

  const outputPath = path.join(process.cwd(), 'public', 'openapi.json');
  fs.writeFileSync(outputPath, JSON.stringify(document, null, 2), 'utf-8');
  console.log(`OpenAPI document generated at ${outputPath}`);
}

// Automatically generate if script is run directly
if (require.main === module) {
  generateOpenAPI();
}
