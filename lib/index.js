require('dotenv').config();
const fs = require('fs').promises; 
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://Trekker:bQTfNbCZKmaHNLbZ@cluster0.yp1ye.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

let mongoClient;
async function connectMongoDB() {
    if (!mongoClient) {
        mongoClient = new MongoClient(MONGODB_URI);
        await mongoClient.connect();
    }
    return mongoClient.db('sessions');
}

function giftedId(num = 22) {
  let result = "";
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const charactersLength = characters.length;
  
  for (let i = 2; i < num; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  
  return `Gifted~${result}`;
}

async function downloadCreds(sessionId) {  
  try {
    if (!sessionId.startsWith('Gifted~')) {
      throw new Error('Invalid SESSION_ID: It must start with "Gifted~"');
    }

    const db = await connectMongoDB();
    const collection = db.collection('credentials');
    
    const document = await collection.findOne({ sessionId: sessionId });
    
    if (!document?.credsData) {
      throw new Error('No sessionData found in database');
    }

    return typeof document.credsData === 'string' 
      ? JSON.parse(document.credsData)
      : document.credsData;
  } catch (error) {
    console.error('Download Error:', error.message);
    throw error;
  }
}

async function removeFile(filePath) {
  try {
    await fs.access(filePath);
    await fs.rm(filePath, { recursive: true, force: true });
    return true;
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Remove Error:', error.message);
    }
    return false;
  }
}

module.exports = { 
  downloadCreds, 
  removeFile, 
  giftedId 
};
