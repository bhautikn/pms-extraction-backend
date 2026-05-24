import dotenv from 'dotenv';
dotenv.config();

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const env = {
  PORT: optional('PORT', '5000'),
  MONGODB_URI: required('MONGODB_URI'),
  JWT_SECRET: required('JWT_SECRET'),
  SETTINGS_ENCRYPTION_KEY: required('SETTINGS_ENCRYPTION_KEY'),
  AZURE_STORAGE_CONNECTION_STRING: optional('AZURE_STORAGE_CONNECTION_STRING', ''),
  AZURE_STORAGE_CONTAINER: optional('AZURE_STORAGE_CONTAINER', 'pmsextractmate-pdfs'),
  FRONTEND_URL: optional('FRONTEND_URL', 'http://localhost:5173'),
  NODE_ENV: optional('NODE_ENV', 'development'),
};
