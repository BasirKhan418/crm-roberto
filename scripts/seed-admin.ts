/**
 * Seed script — creates a separate admin account in the `admins` collection.
 *
 * Usage:
 *   npx tsx scripts/seed-admin.ts <email> <password> [name]
 *   npx tsx scripts/seed-admin.ts admin@crm.com MyStr0ngPass "Super Admin"
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import argon2 from 'argon2';

const MONGO_URI = process.env.MONGO_URI || '';

if (!MONGO_URI) {
  console.error('❌  MONGO_URI is not set in .env');
  process.exit(1);
}

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log('✔  Connected to MongoDB');

  const AdminSchema = new mongoose.Schema(
    {
      name: { type: String, required: true, trim: true },
      email: { type: String, required: true, unique: true, lowercase: true, trim: true },
      password: { type: String, required: true, select: false },
    },
    { timestamps: true },
  );
  const Admin = mongoose.models.Admin ?? mongoose.model('Admin', AdminSchema);

  // Revert any users that were previously given the role field
  const UserSchema = new mongoose.Schema({}, { strict: false });
  const User = mongoose.models.User ?? mongoose.model('User', UserSchema);
  const reverted = await User.updateMany({ role: { $exists: true } }, { $unset: { role: '' } });
  if (reverted.modifiedCount > 0) {
    console.log(`✔  Cleaned up 'role' field from ${reverted.modifiedCount} user(s).`);
  }

  const email = process.argv[2] || '';
  const password = process.argv[3] || '';
  const name = process.argv[4] || 'Super Admin';

  if (!email || !password || password.length < 8) {
    console.error('❌  Usage: npx tsx scripts/seed-admin.ts <email> <password> [name]');
    console.error('   Password must be at least 8 characters.');
    process.exit(1);
  }

  const existing = await Admin.findOne({ email: email.toLowerCase() });
  if (existing) {
    console.log(`ℹ  Admin "${email}" already exists. No changes made.`);
    await mongoose.disconnect();
    process.exit(0);
  }

  const pepper = process.env.PASSWORD_PEPPER || '';
  const hashedPassword = await argon2.hash(password + pepper);

  await Admin.create({ name, email: email.toLowerCase(), password: hashedPassword });
  console.log(`✔  Admin account created: "${name}" (${email.toLowerCase()})`);
  console.log(`🔐  Password used: "${password}"`);

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('❌  Seed failed:', err);
  process.exit(1);
});
