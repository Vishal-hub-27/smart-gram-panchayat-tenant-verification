// Development seed script. Run with: npm run seed
//
// Admins are intentionally NOT publicly self-registrable (see authController
// — there is no POST /api/auth/register/admin). In a real deployment, the
// first admin would be created by a Gram Panchayat official through a
// controlled, offline process. For local development and testing the admin
// role, this script creates one admin account directly in the database.
//
// This is a starting point — Phase 11's fuller seed data (owners, houses,
// tenants, families, applications in various states) will build on this
// same pattern once those models exist.

const bcrypt = require('bcryptjs');
const { config, validateEnv } = require('../config/env');

validateEnv();

const connectDB = require('../config/db');
const User = require('../models/User');
const Admin = require('../models/Admin');
const { generateId } = require('../services/idGeneratorService');

const DEV_ADMIN = {
  phone: '9999999999',
  password: 'Admin@123',
  name: 'Gram Panchayat Admin',
  designation: 'Panchayat Secretary',
};

async function seedAdmin() {
  await connectDB();

  const existing = await User.findOne({ phone: DEV_ADMIN.phone });
  if (existing) {
    console.log(`Admin with phone ${DEV_ADMIN.phone} already exists. Skipping.`);
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(DEV_ADMIN.password, config.bcryptSaltRounds);

  const user = await User.create({
    phone: DEV_ADMIN.phone,
    passwordHash,
    role: 'admin',
    isPhoneVerified: true, // seeded directly; skips the OTP flow intentionally
    isActive: true,
  });

  const adminId = await generateId('ADMIN');

  await Admin.create({
    adminId,
    userId: user._id,
    name: DEV_ADMIN.name,
    designation: DEV_ADMIN.designation,
  });

  console.log('Dev admin created:');
  console.log(`  Admin ID: ${adminId}`);
  console.log(`  Phone:    ${DEV_ADMIN.phone}`);
  console.log(`  Password: ${DEV_ADMIN.password}`);
  console.log('Log in with these credentials at POST /api/auth/login');

  process.exit(0);
}

seedAdmin().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
