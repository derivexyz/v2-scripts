export function requireEnv(env_var: string): string {
  const value = process.env[env_var];
  if (!value) {
    throw new Error(`Missing required environment variable ${env_var}`);
  }
  return value;
}
