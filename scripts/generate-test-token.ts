#!/usr/bin/env -S npx tsx
/**
 * Generate a test access token for API testing.
 * 
 * Usage:
 *   nix develop -c npx tsx scripts/generate-test-token.ts
 *   
 * Or with custom user ID:
 *   nix develop -c npx tsx scripts/generate-test-token.ts <userId>
 */

import { createHmac } from 'crypto';

// Get JWT secret from environment
const JWT_SECRET = process.env['JWT_SECRET'] ?? 'dev-secret-key-change-in-production';

// Default test user - you can override with command line arg
const userId = process.argv[2] ?? 'test-user-id';

// Token expires in 1 year
const ACCESS_TOKEN_EXPIRY_SECONDS = 365 * 24 * 60 * 60;

/**
 * Base64url encode a string or buffer.
 */
function base64urlEncode(input: string | Buffer): string {
  const base64 = Buffer.from(input).toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * JWT header for HS256 algorithm.
 */
const JWT_HEADER = base64urlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));

/**
 * Signs a JWT payload with HMAC-SHA256.
 */
function signJwt(payload: Record<string, unknown>, secret: string): string {
  const encodedPayload = base64urlEncode(JSON.stringify(payload));
  const data = `${JWT_HEADER}.${encodedPayload}`;
  const signature = createHmac('sha256', secret).update(data).digest();
  return `${data}.${base64urlEncode(signature)}`;
}

/**
 * Creates an access token JWT.
 */
function createAccessToken(userId: string, role: string, secret: string): string {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + ACCESS_TOKEN_EXPIRY_SECONDS;

  const payload = {
    sub: userId,
    role,
    iat: now,
    exp,
  };

  return signJwt(payload, secret);
}

// Generate token
const token = createAccessToken(userId, 'admin', JWT_SECRET);

console.log('='.repeat(60));
console.log('Generated Test Access Token');
console.log('='.repeat(60));
console.log(`\nUser ID: ${userId}`);
console.log(`Role: admin`);
console.log(`JWT Secret: ${JWT_SECRET.substring(0, 20)}...`);
console.log(`\nToken:\n${token}`);
console.log('\n' + '='.repeat(60));
console.log('\nUsage examples:');
console.log('\n# Set as environment variable:');
console.log(`export TEST_TOKEN="${token}"`);
console.log('\n# Use with curl:');
console.log(`curl -H "Authorization: Bearer ${token}" http://localhost:3000/api/...`);
console.log('\n# Create playback session:');
console.log(`curl -X POST http://localhost:3000/api/stream/session \\
  -H "Authorization: Bearer ${token}" \\
  -H "Content-Type: application/json" \\
  -d '{"mediaType":"movie","mediaId":"YOUR_MOVIE_ID"}'`);
console.log('='.repeat(60));

