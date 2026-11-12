import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(5000),
  WEB_ORIGIN: z.string().url().default('http://localhost:3000'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DIRECT_URL: z.string().optional(),
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_ANON_KEY: z.string().min(1, 'SUPABASE_ANON_KEY is required'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),
  GEMINI_API_KEY: z.string().optional(),
  LANGSMITH_TRACING: z.enum(['true', 'false']).default('false'),
  LANGSMITH_API_KEY: z.string().optional(),
  LANGSMITH_PROJECT: z.string().default('v3-backend'),
  LANGSMITH_ENDPOINT: z.string().url().default('https://api.smith.langchain.com'),
  TRIGGER_SECRET_KEY: z.string().optional(),
  TRIGGER_PROJECT_ID: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  BHASHINI_UDYAT_KEY: z.string().optional(),
  BHASHINI_INFERENCE_KEY: z.string().optional(),
  INTEGRATION_ENCRYPTION_KEY: z.string().optional(),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  DISCORD_BOT_TOKEN: z.string().optional(),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GITHUB_TOKEN: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
