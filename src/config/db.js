const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri || uri.includes('localhost:27017')) {
      console.log('⚠️  MongoDB URI not configured or local MongoDB not running.');
      console.log('📌 To connect MongoDB Atlas (FREE):');
      console.log('   1. Go to https://cloud.mongodb.com');
      console.log('   2. Create free cluster');
      console.log('   3. Get connection string');
      console.log('   4. Update MONGODB_URI in .env file');
      console.log('   Server will start without DB for now...\n');
      return;
    }
    const conn = await mongoose.connect(uri);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Error: ${error.message}`);
    console.log('⚠️  Server starting without database connection...\n');
  }
};

module.exports = connectDB;
