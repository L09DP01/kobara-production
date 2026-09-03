import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

export const CustomerSchema = z.object({
  name: z.string().optional().openapi({ description: "Full name of the customer", example: "Jean Dupont" }),
  email: z.string().email().optional().openapi({ description: "Email address of the customer", example: "jean@example.com" }),
  phone: z.string().optional().openapi({ description: "Phone number", example: "37000000" }),
}).openapi("Customer");

export const PaymentCreatePayloadSchema = z.object({
  amount: z.number().positive().openapi({ description: "Amount to charge", example: 2500 }),
  currency: z.string().default("HTG").openapi({ description: "Currency of the payment", example: "HTG" }),
  provider: z.preprocess(
    (value) => typeof value === "string" ? value.trim().toLowerCase() : value,
    z.enum(["moncash", "moncash_ussd", "moncash_web", "natcash", "natcash_web", "natcash_ussd", "carte", "card", "paypal", "apple_pay", "google_pay", "kobara"]),
  ).optional().default("kobara").openapi({ description: "Payment provider (case-insensitive): moncash, natcash, card, paypal, apple_pay, google_pay, or kobara. Defaults to kobara (unified checkout page).", example: "card" }),
  description: z.string().optional().openapi({ description: "Description of the payment", example: "Order #12345" }),
  customer: CustomerSchema.optional(),
  success_url: z.string().url().optional().openapi({ description: "URL to redirect after successful payment", example: "https://your-site.com/success" }),
  cancel_url: z.string().url().optional().openapi({ description: "URL to redirect after cancelled/failed payment", example: "https://your-site.com/cancel" }),
  metadata: z.record(z.string(), z.any()).optional().openapi({ description: "Key-value object for custom data", example: { order_id: "ORD-12345" } }),
}).openapi("PaymentCreatePayload");

export const PaymentResponseSchema = z.object({
  status: z.literal("success"),
  data: z.object({
    id: z.string().openapi({ example: "pay_123456" }),
    reference: z.string().openapi({ example: "KOB-123456" }),
    amount: z.number().openapi({ example: 2500 }),
    status: z.enum(["pending", "succeeded", "failed", "expired", "refunded"]).openapi({ example: "pending" }),
    checkout_url: z.string().url().openapi({ example: "https://kobara.app/pay/pay_123456" }),
    url: z.string().url().openapi({ description: "Backward-compatible alias of checkout_url", example: "https://kobara.app/pay/pay_123456" }),
  })
}).openapi("PaymentResponse");

export const WithdrawalCreatePayloadSchema = z.object({
  amount: z.number().finite().positive().multipleOf(0.01).openapi({
    description: "Gross amount debited from the selected Kobara balance. Withdrawal fees are deducted from this amount.",
    example: 1000,
  }),
  method: z.preprocess(
    (value) => typeof value === "string" ? value.trim().toLowerCase() : value,
    z.enum(["moncash", "natcash"]),
  ).default("moncash").openapi({
    description: "Supported mobile wallet payout method.",
    example: "moncash",
  }),
  account_currency: z.preprocess(
    (value) => typeof value === "string" ? value.trim().toUpperCase() : value,
    z.enum(["HTG", "USD"]),
  ).default("HTG").openapi({
    description: "Kobara balance to debit. A USD balance must already be active when USD is selected.",
    example: "HTG",
  }),
  wallet: z.string().trim().min(1).max(32).openapi({
    description: "Haitian MonCash or NatCash destination number.",
    example: "50934567890",
  }),
  description: z.string().trim().max(255).optional().openapi({
    description: "Internal withdrawal description.",
    example: "Retrait principal boutique",
  }),
}).strict().openapi("WithdrawalCreatePayload");

export const WithdrawalResponseSchema = z.object({
  status: z.literal("success"),
  data: z.object({
    id: z.string().uuid(),
    reference: z.string(),
    status: z.enum(["pending", "pending_approval", "completed"]),
    method: z.enum(["moncash", "natcash"]),
    amount: z.number().openapi({ description: "Gross amount debited from the merchant balance.", example: 1000 }),
    fees: z.number().openapi({ description: "Withdrawal fee deducted from the gross amount.", example: 50 }),
    net_amount: z.number().openapi({ description: "Net amount after withdrawal fees, before currency conversion.", example: 950 }),
    currency: z.enum(["HTG", "USD"]),
    payout_amount: z.number().openapi({ description: "Amount sent to the destination wallet.", example: 950 }),
    payout_currency: z.literal("HTG"),
    exchange_rate: z.number(),
    wallet: z.string(),
    description: z.string().nullable(),
    created_at: z.string(),
  }),
}).openapi("WithdrawalResponse");
