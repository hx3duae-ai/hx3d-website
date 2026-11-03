import argon2 from 'argon2';
// Kept free of 'server-only' so tests and the seed script can use it.
export const hashPassword = (p: string) => argon2.hash(p, { type: argon2.argon2id });
export const verifyPassword = (hash: string, p: string) => argon2.verify(hash, p);
