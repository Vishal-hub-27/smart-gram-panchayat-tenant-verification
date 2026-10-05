const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

const { config } = require('./config/env');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');
const { success } = require('./utils/response');

const app = express();

// ---- Core middleware ----
app.use(cors({ origin: config.clientUrl, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

if (!config.isProduction) {
  app.use(morgan('dev'));
}

// Serve uploaded documents/photos statically (dev only — swap for
// S3/Cloudinary in production so files aren't served directly off disk).
app.use(`/${config.uploadDir}`, express.static(path.join(__dirname, config.uploadDir)));

// ---- Health check ----
app.get('/api/health', (req, res) => {
  success(res, 200, 'Gram Panchayat API is running', {
    env: config.nodeEnv,
    time: new Date().toISOString(),
  });
});

// ---- Feature routes will be mounted here phase by phase ----
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/houses', require('./routes/houseRoutes'));
app.use('/api/rooms', require('./routes/roomRoutes'));
app.use('/api/tenants', require('./routes/tenantRoutes'));
app.use('/api/families', require('./routes/familyRoutes'));
app.use('/api/verifications', require('./routes/verificationRoutes'));
app.use('/api/transfers', require('./routes/transferRoutes'));
app.use('/api/move-outs', require('./routes/moveOutRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/audit-logs', require('./routes/auditRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/search', require('./routes/searchRoutes'));
// Phase varies: app.use('/api/admin', require('./routes/adminRoutes'));

// ---- Error handling (must be last) ----
app.use(notFound);
app.use(errorHandler);

module.exports = app;
