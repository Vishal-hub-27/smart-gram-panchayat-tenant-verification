const { config, validateEnv } = require('./config/env');

validateEnv();

const connectDB = require('./config/db');
const app = require('./app');

async function start() {
  await connectDB();

  const server = app.listen(config.port, () => {
    console.log(`Server running in ${config.nodeEnv} mode on port ${config.port}`);
  });

  // Guard against unhandled promise rejections crashing the process silently.
  process.on('unhandledRejection', (err) => {
    console.error('Unhandled Rejection:', err.message);
    server.close(() => process.exit(1));
  });
}

start();
