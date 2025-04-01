import dotenv from "dotenv";

dotenv.config();

function getEnvVariable(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (!value && defaultValue === undefined) {
    throw new Error(`Environment variable ${key} is not set.`);
  }
  return value || defaultValue!;
}

export const config = {
  EMAIL: getEnvVariable("EMAIL"),
  PASSWORD: getEnvVariable("PASSWORD"),
  JWT_SECRET: getEnvVariable("JWT_SECRET", "default_secret"),
  FRONT_URL: getEnvVariable("FRONT_URL", "https://hexapink.fr"),
  DB_URI: getEnvVariable("DB_URI", "mongodb://localhost:27017/mydatabase"),
  CAPTCHA_SECRET_KEY: getEnvVariable(
    "CAPTCHA_SECRET_KEY",
    "0x4AAAAAABBbhWWtDWHvNyxqeoZ3rYKOEh0"
  ),
  STRIPE_SECRET_KEY: getEnvVariable(
    "STRIPE_SECRET_KEY",
    "sk_test_51QuVH7P1QFnNqlzR0yyZARW7l8CNUcbP2LnLx7w69kpGtHe48sz3TsOedFusoA3Ao13pPZISeeKhkTEKu7cyX4s000hUAjZVSq"
  )
};
