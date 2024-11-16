// backend/scripts/test-db-connection.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function testConnection() {
  try {
    console.log('Testing MongoDB connection...');
    console.log('MongoDB URI:', process.env.MONGODB_URI?.replace(/:[^:@]*@/, ':****@'));
    
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4
    });

    console.log('Connection successful!');
    console.log('Connected to database:', conn.connection.name);
    console.log('Host:', conn.connection.host);
    console.log('Port:', conn.connection.port);

    // Test basic operations
    const collections = await conn.connection.db.listCollections().toArray();
    console.log('\nAvailable collections:');
    collections.forEach(collection => {
      console.log('-', collection.name);
    });

  } catch (error) {
    console.error('Connection failed:', error);
  } finally {
    await mongoose.disconnect();
    process.exit();
  }
}

testConnection();