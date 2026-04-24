import { z } from "zod";

const envSchema = z.object({
  VITE_GOOGLE_CLIENT_ID: z.string().optional().or(z.literal("")),
  VITE_BILLING_API_BASE_URL: z
    .string()
    .url()
    .optional()
    .or(z.literal("")),
  VITE_RESET_EMAIL_WEBHOOK_URL: z
    .string()
    .url()
    .optional()
    .or(z.literal("")),
  VITE_COLLECTIONS_WEBHOOK_URL: z
    .string()
    .url()
    .optional()
    .or(z.literal("")),
  VITE_COLLECTIONS_WHATSAPP_WEBHOOK_URL: z
    .string()
    .url()
    .optional()
    .or(z.literal("")),
  VITE_COLLECTIONS_STATUS_WEBHOOK_URL: z
    .string()
    .url()
    .optional()
    .or(z.literal("")),
  VITE_INVOICE_EMAIL_WEBHOOK_URL: z
    .string()
    .url()
    .optional()
    .or(z.literal("")),
});

export type AppEnv = z.infer<typeof envSchema>;

export function readEnv(): AppEnv {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const envObj = (import.meta as unknown as Record<string, Record<string, string>>).env ?? {};
  const parsed = envSchema.safeParse(envObj);
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    console.warn(`Environment validation: ${message}`);
    return {
      VITE_GOOGLE_CLIENT_ID: "",
      VITE_BILLING_API_BASE_URL: "",
      VITE_RESET_EMAIL_WEBHOOK_URL: "",
      VITE_COLLECTIONS_WEBHOOK_URL: "",
      VITE_COLLECTIONS_WHATSAPP_WEBHOOK_URL: "",
      VITE_COLLECTIONS_STATUS_WEBHOOK_URL: "",
      VITE_INVOICE_EMAIL_WEBHOOK_URL: "",
    };
  }
  return parsed.data;
}
