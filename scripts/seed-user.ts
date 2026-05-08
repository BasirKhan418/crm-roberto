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

  const UserSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    isOnboardingComplete: { type: Boolean, default: false },
    isEmailVerified: { type: Boolean, default: false },
    account_status: { type: String, default: 'active' },
  }, { timestamps: true });

  const User = mongoose.models.User ?? mongoose.model('User', UserSchema);

  const email = process.argv[2] || '';
  const password = process.argv[3] || '';
  const name = process.argv[4] || 'Usuário Padrão';

  if (!email || !password || password.length < 8) {
    console.error('❌  Usage: npx tsx scripts/seed-user.ts <email> <password> [name]');
    console.error('   Password must be at least 8 characters.');
    process.exit(1);
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    console.log(`ℹ  User "${email}" already exists. Updating to verified...`);
    existing.isEmailVerified = true;
    existing.isOnboardingComplete = true;
    existing.account_status = 'active';
    await existing.save();
    console.log(`✔  User updated!`);
    await mongoose.disconnect();
    process.exit(0);
  }

  const pepper = process.env.PASSWORD_PEPPER || '';
  const hashedPassword = await argon2.hash(password + pepper);

  await User.create({
    name,
    email: email.toLowerCase(),
    password: hashedPassword,
    isEmailVerified: true, // Já pula a etapa do e-mail
    isOnboardingComplete: true, // Já pula as perguntas iniciais
    account_status: 'active'
  });
  console.log(`✔  User account created and verified: "${name}" (${email.toLowerCase()})`);

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('❌  Seed failed:', err);
  process.exit(1);
});
