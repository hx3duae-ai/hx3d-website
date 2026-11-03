// Creates or promotes an admin. Credentials come only from the environment; nothing is hard-coded.
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/password';
const db = new PrismaClient();
async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const pw = process.env.ADMIN_PASSWORD;
  if (!email || !pw || pw.length < 10) {
    console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD (10+ chars) in the environment. Nothing was changed.');
    process.exit(1);
  }
  await db.user.upsert({
    where: { email }, update: { role: 'ADMIN' },
    create: { email, name: 'Admin', passwordHash: await hashPassword(pw), role: 'ADMIN' },
  });
  console.log('Admin ready:', email);
}
main().finally(() => db.$disconnect());
