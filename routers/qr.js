const {
    default: Gifted_Tech,
    useMultiFileAuthState,
    Browsers,
    delay,
    jidNormalizedUser,
    DisconnectReason,
    makeInMemoryStore
} = require("@whiskeysockets/baileys");

const { giftedId, removeFile } = require('../lib');
const express = require("express");
const router = express.Router();
const pino = require("pino");
const { toBuffer } = require("qrcode");
const path = require('path');
require('dotenv').config();
const fs = require('fs').promises;
const fsSync = require('fs'); 
const NodeCache = require('node-cache');
const { Boom } = require("@hapi/boom");
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
        while (isConnecting) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        return mongoClient.db('sessions');
    }
    
    try {
        isConnecting = true;
        mongoClient = new MongoClient(process.env.MONGODB_URI, {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            family: 4
        });
        
        await mongoClient.connect();
        return mongoClient.db('sessions');
    } catch (error) {
        console.error('MongoDB connection failed:', error.message);
        mongoClient = null;
        throw error;
    } finally {
        isConnecting = false;
    }
}

async function uploadCreds(id) {
    const authPath = path.join(__dirname, 'temp', id, 'creds.json');
    let credsId = null;
    
    try {
        if (!fsSync.existsSync(authPath)) {
            throw new Error(`Credentials file not found at: ${authPath}`);
        }

        let credsData;
        try {
            credsData = JSON.parse(await fs.readFile(authPath, 'utf8'));
        } catch (parseError) {
            throw new Error(`Failed to parse credentials file: ${parseError.message}`);
        }

        if (!credsData || typeof credsData !== 'object') {
            throw new Error('Invalid credentials data format');
        }

        credsId = giftedId();
        console.log(`Uploading credentials with session ID: ${credsId}`);
        
        const db = await connectMongoDB();
        const collection = db.collection('credentials');
        const now = new Date();
        
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
            error: error.message
        });
        return null;
    }
}

router.get("/", async (req, res) => {
    const id = giftedId();
    const authDir = path.join(__dirname, 'temp', id);
        
    try {
        try {
            await fs.access(authDir);
        } catch {
            await fs.mkdir(authDir, { recursive: true });
        }

        async function GIFTED_QR_CODE() {
            const { state, saveCreds } = await useMultiFileAuthState(authDir);
            const msgRetryCounterCache = new NodeCache();

            try {
                let Gifted = Gifted_Tech({
                    printQRInTerminal: false,
                    logger: pino({ level: "silent" }),
                    browser: Browsers.baileys("Desktop"),
                    auth: state,
                    msgRetryCounterCache,
                    defaultQueryTimeoutMs: undefined
                });

                Gifted.ev.on("connection.update", async (update) => {
                    const { connection, lastDisconnect, qr } = update;

                    if (qr) {
                        try {
                            const qrBuffer = await toBuffer(qr);
                            if (!res.headersSent) {
                                res.type('png').send(qrBuffer);
                            }
                        } catch (qrError) {
                            console.error('QR render error:', qrError);
                            if (!res.headersSent) {
                                res.status(500).send("QR generation failed");
                            }
                        }
                    }

                    if (connection === "open") {
                        try {
                            await delay(3000); 
                            const sessionId = await uploadCreds(id);
                            if (!sessionId) {
                                throw new Error('Failed to upload credentials');
                            }
                            
                            const session = await Gifted.sendMessage(Gifted.user.id, { text: sessionId });
                            
                            const GIFTED_TEXT = `
*✅ SESSION ID GENERATED ✅*
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

Use the Quoted Session ID to Deploy your Bot
Validate it First Using the Validator Link.`; 
                            
                            await Gifted.sendMessage(Gifted.user.id, { text: GIFTED_TEXT }, { quoted: session });
                            await delay(1000);
                            await Gifted.ws.close();
                            await removeFile(authDir);
                            
                        } catch (error) {
                            console.error('Session processing failed:', error);
                            
                            try {
                                await Gifted.sendMessage(Gifted.user.id, {
                                    text: '⚠️ Session upload failed. Please try again.'
                                });
                            } catch (msgError) {
                                console.error('Failed to send error message:', msgError);
                            }
                            
                            try {
                                await Gifted.ws.close();
                                await removeFile(authDir);
                            } catch (cleanupError) {
                                console.error('Cleanup failed:', cleanupError);
                            }
                        }
                    }

                    if (connection === "close") {
                        const statusCode = new Boom(lastDisconnect?.error)?.output.statusCode;
                        
                        if (statusCode === DisconnectReason.restartRequired) {
                            await delay(2000);
                            GIFTED_QR_CODE().catch(err => console.error('Restart failed:', err));
                        }
                    }
                });

                Gifted.ev.on('creds.update', saveCreds);

            } catch (error) {
                console.error("Initialization error:", error);
                try {
                    await removeFile(authDir);
                } catch (cleanupError) {
                    console.error('Initial cleanup failed:', cleanupError);
                }
                
                if (!res.headersSent) {
                    res.status(500).send("Initialization failed");
                }
            }
        }

        await GIFTED_QR_CODE();
    } catch (error) {
        console.error("Fatal error:", error);
        try {
            await removeFile(authDir);
        } catch (finalCleanupError) {
            console.error('Final cleanup failed:', finalCleanupError);
        }
        
        if (!res.headersSent) {
            res.status(500).send("Service unavailable");
        }
    }
});

module.exports = router;
