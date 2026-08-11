export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  const isProd = process.env.NODE_ENV === 'production';
  if (isProd && (!secret || secret === 'dev-secret' || secret.length < 32)) {
    throw new Error('JWT_SECRET must be set to a strong secret in production');
  }
  return secret ?? 'dev-secret';
}
