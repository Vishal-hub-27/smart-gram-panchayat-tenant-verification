// Centralized environment configuration.
// Every other file should read config from here instead of process.env directly.
// This makes it easy to validate required variables in one place and avoids
// scattering "process.env.X" (and typos) across the codebase.

require('dotenv').config();

const required = ['MONGO_URI', 'JWT_SECRET'];

function validateEnv() {
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    // Fail fast and loud at boot rather than crashing later mid-request.
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
    console.error('Copy server/.env.example to server/.env and fill in real values.');
    process.exit(1);
  }
}

const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',

  mongoUri: process.env.MONGO_URI,

  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  otpExpiryMinutes: parseInt(process.env.OTP_EXPIRY_MINUTES, 10) || 5,
  otpMockMode: process.env.OTP_MOCK_MODE !== 'false',

  bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 10,

  maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 5,
  uploadDir: process.env.UPLOAD_DIR || 'uploads',

  authRateLimitWindowMinutes: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MINUTES, 10) || 15,
  authRateLimitMaxRequests: parseInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS, 10) || 10,

  isProduction: process.env.NODE_ENV === 'production',
};

module.exports = { config, validateEnv };
