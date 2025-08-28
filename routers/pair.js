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
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    throw new Error("❌ MONGODB_URI is missing in .env file");
}

let mongoClient;
async function connectMongoDB() {
    if (!mongoClient) {
        mongoClient = new MongoClient(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            maxPoolSize: 10,
        });
        await mongoClient.connect();
        console.log("✅ MongoDB Connected");
    }
    return mongoClient.db('sessions');
}

const {
    default: Gifted_Tech,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers
} = require("@whiskeysockets/baileys");

async function uploadCreds(id) {
    try {
        const authPath = path.join(__dirname, 'temp', id, 'creds.json');
        if (!fs.existsSync(authPath)) {
            console.error('❌ Creds file not found at:', authPath);
            return null;
        }

        const credsData = JSON.parse(fs.readFileSync(authPath, 'utf8'));
        const credsId = giftedId();

        const db = await connectMongoDB();
        const collection = db.collection('credentials');

        // Upsert session: update if exists, insert if new
        await collection.updateOne(
            { "credsData.me.id": credsData.me?.id || credsId },
            {
                $set: {
                    sessionId: credsId,
                    credsData,
                    updatedAt: new Date()
                },
                $setOnInsert: { createdAt: new Date() }
            },
            { upsert: true }
        );

        console.log("✅ Session saved to MongoDB:", credsId);
        return credsId;
    } catch (error) {
        console.error('❌ Error uploading credentials:', error.message);
        return null;
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
                console.log(`📲 Pairing Code for ${num}: ${code}`);

                if (!res.headersSent) {
                    res.send({ code });
                }
            }

            Gifted.ev.on('creds.update', saveCreds);
            
            Gifted.ev.on("connection.update", async (s) => {
                const { connection, lastDisconnect } = s;

                if (connection === "open") {
                    await delay(5000);
                    
                    try {
                        const sessionId = await uploadCreds(id);
                        if (!sessionId) {
                            throw new Error('❌ Failed to upload credentials to MongoDB');
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
║❒ Tutorial: _youtube.com/@giftedtechnexus_
║❒ Owner: _https://t.me/mouricedevs_
║❒ Repo: _https://github.com/mauricegift/gifted-md_
║❒ Validator: _https://pairing.giftedtech.web.id/validate_
║❒ Channel: _https://whatsapp.com/channel/0029Vb3hlgX5kg7G0nFggl0Y_
║ 💜💜💜
╚══════════════╝ 
𝗚𝗜𝗙𝗧𝗘𝗗-𝗠𝗗 𝗩𝗘𝗥𝗦𝗜𝗢𝗡 5.𝟬.𝟬
______________________________

Use the quoted Session ID to deploy your bot.
Validate it first using the Validator link.`;

                        await Gifted.sendMessage(Gifted.user.id, { text: GIFTED_TEXT }, { quoted: session });
                    } catch (err) {
                        console.error('❌ Error in connection update:', err);
                    } finally {
                        await delay(100);
                        await Gifted.ws.close();
                        removeFile(authDir).catch(err => console.error('Error removing temp files:', err));
                    }
                } else if (connection === "close" && lastDisconnect?.error?.output?.statusCode !== 401) {
                    await delay(10000);
                    GIFTED_PAIR_CODE().catch(err => console.error('Error restarting pairing:', err));
                }
            });
        } catch (err) {
            console.error("❌ Service Error:", err);
            removeFile(authDir).catch(err => console.error('Error cleaning up:', err));

            if (!res.headersSent) {
                res.status(500).send({ error: "Service is currently unavailable" });
            }
        }
    }

    await GIFTED_PAIR_CODE();
});

module.exports = router;
