const mongoose = require('mongoose');
const { config } = require('./env');

async function connectDB() {
  try {
    mongoose.set('strictQuery', true);

    const conn = await mongoose.connect(config.mongoUri);

    console.log(`MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);

    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected');
    });

    return conn;
  } catch (err) {
    console.error('Failed to connect to MongoDB:', err.message);
    // Exit — the API is useless without a database connection, better to
    // fail loudly at startup than serve requests that will all error out.
    process.exit(1);
  }
}

module.exports = connectDB;
