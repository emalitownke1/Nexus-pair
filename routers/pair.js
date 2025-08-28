const { 
    giftedId,
    removeFile
} = require('../lib'); 

const express = require('express');
const fs = require('fs');
const axios = require('axios');
require('dotenv').config();
const path = require('path');
let router = express.Router();
const pino = require("pino");

const SESSIONS_API_URL = process.env.SESSIONS_API_URL;
const SESSIONS_API_KEY = process.env.SESSIONS_API_KEY;

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
        
        // Check if file exists using async method
        try {
            await fs.promises.access(authPath);
        } catch {
            console.error('Creds file not found at:', authPath);
            return null;
        }

        // Add a small delay to ensure file is fully written
        await delay(1000);

        const credsData = JSON.parse(await fs.promises.readFile(authPath, 'utf8'));
        const credsId = giftedId();
        
        console.log('Uploading credentials with ID:', credsId);
        
        const response = await axios.post(
            `${SESSIONS_API_URL}/api/uploadCreds.php`,
            { credsId, credsData },
            {
                headers: {
                    'x-api-key': SESSIONS_API_KEY,
                    'Content-Type': 'application/json',
                },
                timeout: 15000
            }
        );
        
        console.log('Upload response status:', response.status);
        return credsId;
    } catch (error) {
        console.error('Error uploading credentials:', error.response?.data || error.message);
        return null;
    }
}

router.get('/', async (req, res) => {
    const id = giftedId(); 
    let num = req.query.number;

    if (!num) {
        return res.status(400).send({ error: "Phone number is required" });
    }

    // Store the user's number for later use
    const userNumber = num.replace(/[^0-9]/g, '') + '@s.whatsapp.net';

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
                    console.log('Connection opened successfully, preparing session...');
                    await delay(3000); // Wait for connection to stabilize
                    
                    try {
                        // Path to the creds.json file
                        const authPath = path.join(authDir, 'creds.json');
                        
                        // Wait a bit more to ensure creds.json is fully written
                        await delay(2000);
                        
                        // Check if creds.json exists
                        if (!fs.existsSync(authPath)) {
                            throw new Error('Credentials file not found after connection');
                        }

                        // Read the creds.json file
                        const credsData = await fs.promises.readFile(authPath, 'utf8');
                        console.log('Successfully read creds.json file');
                        
                        // Convert creds.json to base64 string as session ID
                        const sessionId = Buffer.from(credsData).toString('base64');
                        console.log('Generated base64 session ID from creds.json');
                        
                        // Optional: Upload to database for backup
                        try {
                            const uploadedSessionId = await uploadCreds(id);
                            if (uploadedSessionId) {
                                console.log('Backup uploaded to database:', uploadedSessionId);
                            }
                        } catch (uploadErr) {
                            console.warn('Database upload failed, but continuing with base64 session:', uploadErr.message);
                        }

                        // Send the base64-encoded creds.json as session ID to user
                        const session = await Gifted.sendMessage(userNumber, { text: sessionId });

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

The Above Message Contains Your Session ID (Base64 Encoded creds.json).
Save It Securely and Use It to Deploy Your Bot.`;

                        await Gifted.sendMessage(userNumber, { text: GIFTED_TEXT }, { quoted: session });
                        console.log('Session ID sent successfully to user');
                        
                    } catch (err) {
                        console.error('Error generating session:', err);
                        try {
                            await Gifted.sendMessage(userNumber, { 
                                text: '❌ Error generating session. Please try the pairing process again.' 
                            });
                        } catch (msgErr) {
                            console.error('Failed to send error message:', msgErr);
                        }
                    } finally {
                        await delay(1000);
                        await Gifted.ws.close();
                        removeFile(authDir).catch(err => console.error('Error removing temp files:', err));
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
