const { 
    giftedId,
    removeFile
} = require('../lib'); 

const express = require('express');
const fs = require('fs'); 
require('dotenv').config();
const path = require('path');
let router = express.Router();
const pino = require("pino");

const { MongoClient } = require('mongodb');

let mongoClient;
let isConnecting = false;

async function connectMongoDB() {
    if (!process.env.MONGODB_URI) {
        throw new Error('MONGODB_URI environment variable is not set');
    }
    
    if (mongoClient && mongoClient.topology && mongoClient.topology.isConnected()) {
        return mongoClient.db('sessions');
    }
    
    if (isConnecting) {
        // Wait for existing connection attempt
        while (isConnecting) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        return mongoClient.db('sessions');
    }
    
    try {
        isConnecting = true;
        console.log('Establishing MongoDB connection...');
        
        mongoClient = new MongoClient(process.env.MONGODB_URI, {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            family: 4
        });
        
        await mongoClient.connect();
        console.log('MongoDB connected successfully');
        
        return mongoClient.db('sessions');
    } catch (error) {
        console.error('MongoDB connection failed:', error.message);
        mongoClient = null;
        throw error;
    } finally {
        isConnecting = false;
    }
}

// Graceful shutdown
process.on('SIGINT', async () => {
    if (mongoClient) {
        await mongoClient.close();
        console.log('MongoDB connection closed');
    }
    process.exit(0);
});

const {
    default: Gifted_Tech,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers
} = require("@whiskeysockets/baileys");

async function uploadCreds(id) {
    const authPath = path.join(__dirname, 'temp', id, 'creds.json');
    let credsId = null;
    
    try {
        // Verify creds file exists
        if (!fs.existsSync(authPath)) {
            throw new Error(`Credentials file not found at: ${authPath}`);
        }

        // Parse credentials data
        let credsData;
        try {
            credsData = JSON.parse(fs.readFileSync(authPath, 'utf8'));
        } catch (parseError) {
            throw new Error(`Failed to parse credentials file: ${parseError.message}`);
        }

        // Validate credentials data
        if (!credsData || typeof credsData !== 'object') {
            throw new Error('Invalid credentials data format');
        }

        credsId = giftedId();
        console.log(`Uploading credentials with session ID: ${credsId}`);
        
        // Connect to MongoDB with retry logic
        let db;
        let retryCount = 0;
        const maxRetries = 3;
        
        while (retryCount < maxRetries) {
            try {
                db = await connectMongoDB();
                break;
            } catch (connError) {
                retryCount++;
                console.warn(`MongoDB connection attempt ${retryCount} failed:`, connError.message);
                if (retryCount === maxRetries) {
                    throw new Error(`Failed to connect to MongoDB after ${maxRetries} attempts`);
                }
                await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
            }
        }
        
        const collection = db.collection('credentials');
        const now = new Date();
        
        // Use upsert to avoid duplicates and ensure updatedAt is refreshed
        const result = await collection.updateOne(
            { sessionId: credsId },
            {
                $set: {
                    sessionId: credsId,
                    credsData: credsData,
                    updatedAt: now
                },
                $setOnInsert: {
                    createdAt: now
                }
            },
            { upsert: true }
        );
        
        if (result.acknowledged) {
            const operation = result.upsertedCount > 0 ? 'inserted' : 'updated';
            console.log(`Credentials successfully ${operation} for session: ${credsId}`);
            return credsId;
        } else {
            throw new Error('Database operation was not acknowledged');
        }
        
    } catch (error) {
        console.error('Error in uploadCreds:', {
            sessionId: credsId,
            tempId: id,
            error: error.message,
            stack: error.stack
        });
        return null;
    } finally {
        // Clean up temp directory regardless of success/failure
        try {
            const tempDir = path.join(__dirname, 'temp', id);
            if (fs.existsSync(tempDir)) {
                await removeFile(tempDir);
                console.log(`Cleaned up temp directory: ${tempDir}`);
            }
        } catch (cleanupError) {
            console.warn('Error cleaning up temp directory:', cleanupError.message);
        }
    }
}

router.get('/', async (req, res) => {
    const id = giftedId(); 
    let num = req.query.number;

    if (!num) {
        return res.status(400).send({ error: "Phone number is required" });
    }

    async function GIFTED_PAIR_CODE() {
        const authDir = path.join(__dirname, 'temp', id);
        
        try {
            if (!fs.existsSync(authDir)) {
                fs.mkdirSync(authDir, { recursive: true });
            }

            const { state, saveCreds } = await useMultiFileAuthState(authDir);

            let Gifted = Gifted_Tech({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
                },
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }).child({ level: "fatal" }),
                browser: Browsers.macOS("Safari")
            });

            if (!Gifted.authState.creds.registered) {
                await delay(1500);
                num = num.replace(/[^0-9]/g, '');
                const code = await Gifted.requestPairingCode(num);
                console.log(`Your Code: ${code}`);

                if (!res.headersSent) {
                    res.send({ code });
                }
            }

            Gifted.ev.on('creds.update', saveCreds);
            
            Gifted.ev.on("connection.update", async (s) => {
                const { connection, lastDisconnect } = s;

                if (connection === "open") {
                    console.log(`Connection opened for pairing session: ${id}`);
                    await delay(5000);
                    
                    try {
                        console.log('Attempting to upload credentials...');
                        const sessionId = await uploadCreds(id);
                        
                        if (!sessionId) {
                            throw new Error('Failed to upload credentials to MongoDB');
                        }

                        console.log(`Session ID generated successfully: ${sessionId}`);
                        const session = await Gifted.sendMessage(Gifted.user.id, { text: sessionId });

                        const GIFTED_TEXT = `
*✅sᴇssɪᴏɴ ɪᴅ ɢᴇɴᴇʀᴀᴛᴇᴅ✅*
______________________________
╔════◇
║『 𝐘𝐎𝐔'𝐕𝐄 𝐂𝐇𝐎𝐒𝐄𝐍 𝐆𝐈𝐅𝐓𝐄𝐃 𝐌𝐃 』
╚══════════════╝
╔═════◇
║ 『••• 𝗩𝗶𝘀𝗶𝘁 𝗙𝗼𝗿 𝗛𝗲𝗹𝗽 •••』
║❒ 𝐓𝐮𝐭𝐨𝐫𝐢𝐚𝐥: _youtube.com/@giftedtechnexus_
║❒ 𝐎𝐰𝐧𝐞𝐫: _https://t.me/mouricedevs_
║❒ 𝐑𝐞𝐩𝐨: _https://github.com/mauricegift/gifted-md_
║❒ 𝐕𝐚𝐥𝐢𝐝𝐚𝐭𝐨𝐫: _https://pairing.giftedtech.web.id/validate_
║❒ 𝐖𝐚𝐂𝐡𝐚𝐧𝐧𝐞𝐥: _https://whatsapp.com/channel/0029Vb3hlgX5kg7G0nFggl0Y_
║ 💜💜💜
╚══════════════╝ 
 𝗚𝗜𝗙𝗧𝗘𝗗-𝗠𝗗 𝗩𝗘𝗥𝗦𝗜𝗢𝗡 5.𝟬.𝟬
______________________________

Use the Quoted Session ID to Deploy your Bot.
Validate it First Using the Validator Link.`;

                        await Gifted.sendMessage(Gifted.user.id, { text: GIFTED_TEXT }, { quoted: session });
                        console.log('Session ID sent successfully to user');
                        
                    } catch (err) {
                        console.error('Error in connection update:', {
                            sessionId: id,
                            error: err.message,
                            stack: err.stack
                        });
                        
                        // Try to send error message to user if possible
                        try {
                            if (Gifted.user?.id) {
                                await Gifted.sendMessage(Gifted.user.id, { 
                                    text: '❌ Session generation failed. Please try again.' 
                                });
                            }
                        } catch (msgError) {
                            console.error('Failed to send error message to user:', msgError.message);
                        }
                    } finally {
                        console.log(`Cleaning up connection for session: ${id}`);
                        await delay(100);
                        
                        try {
                            if (Gifted.ws && Gifted.ws.readyState === 1) {
                                await Gifted.ws.close();
                            }
                        } catch (closeError) {
                            console.warn('Error closing WebSocket:', closeError.message);
                        }
                        
                        // Final cleanup of auth directory (backup cleanup)
                        try {
                            if (fs.existsSync(authDir)) {
                                await removeFile(authDir);
                                console.log(`Final cleanup completed for: ${authDir}`);
                            }
                        } catch (cleanupError) {
                            console.error('Error in final cleanup:', cleanupError.message);
                        }
                    }
                } else if (connection === "close" && lastDisconnect?.error?.output?.statusCode !== 401) {
                    await delay(10000);
                    GIFTED_PAIR_CODE().catch(err => console.error('Error restarting pairing:', err));
                }
            });
        } catch (err) {
            console.error("Service Error:", err);
            removeFile(authDir).catch(err => console.error('Error cleaning up:', err));

            if (!res.headersSent) {
                res.status(500).send({ error: "Service is Currently Unavailable" });
            }
        }
    }

    await GIFTED_PAIR_CODE();
});

module.exports = router;
