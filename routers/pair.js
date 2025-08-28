const { 
    trekkerId,
    removeFile
} = require('../lib'); 

const express = require('express');
const fs = require('fs'); 
require('dotenv').config();
const path = require('path');
let router = express.Router();
const pino = require("pino");

// Local storage for sessions instead of MongoDB
const sessionStorage = new Map();

// Cleanup function to remove expired sessions
function cleanupExpiredSessions() {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000); // 5 minutes ago
    
    for (const [sessionId, sessionData] of sessionStorage.entries()) {
        if (sessionData.createdAt < fiveMinutesAgo) {
            sessionStorage.delete(sessionId);
            console.log(`🧹 Cleaned up expired session: ${sessionId}`);
        }
    }
}

// Run cleanup every minute
setInterval(cleanupExpiredSessions, 60000);

const {
    default: Gifted_Tech,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers
} = require("@whiskeysockets/baileys");

async function saveSessionLocally(id, Gifted) {
    const authPath = path.join(__dirname, 'temp', id, 'creds.json');
    let credsId = null;

    try {
        console.log(`=== LOCAL SESSION SAVE FUNCTION START ===`);
        console.log(`Temp ID: ${id}`);
        console.log(`Auth path: ${authPath}`);

        // Send status update to user
        await Gifted.sendMessage(Gifted.user.id, { 
            text: '🔄 Processing session credentials...' 
        });

        // Verify creds file exists
        if (!fs.existsSync(authPath)) {
            console.error(`❌ File does not exist at: ${authPath}`);
            await Gifted.sendMessage(Gifted.user.id, { 
                text: '❌ Credentials file not found. Please try pairing again.' 
            });
            throw new Error(`Credentials file not found at: ${authPath}`);
        }

        console.log(`✅ File exists at: ${authPath}`);
        await Gifted.sendMessage(Gifted.user.id, { 
            text: '✅ Credentials file found. Validating...' 
        });

        // Parse credentials data
        let credsData;
        try {
            const rawData = fs.readFileSync(authPath, 'utf8');
            console.log(`Raw file content length: ${rawData.length}`);
            credsData = JSON.parse(rawData);
            console.log(`✅ JSON parsed successfully`);
        } catch (parseError) {
            console.error(`❌ Parse error: ${parseError.message}`);
            await Gifted.sendMessage(Gifted.user.id, { 
                text: '❌ Invalid credentials format. Please try pairing again.' 
            });
            throw new Error(`Failed to parse credentials file: ${parseError.message}`);
        }

        // Validate credentials data
        if (!credsData || typeof credsData !== 'object') {
            console.error(`❌ Invalid creds data type: ${typeof credsData}`);
            await Gifted.sendMessage(Gifted.user.id, { 
                text: '❌ Invalid credentials data. Please try again.' 
            });
            throw new Error('Invalid credentials data format');
        }

        console.log(`✅ Credentials data validated`);
        await Gifted.sendMessage(Gifted.user.id, { 
            text: '✅ Credentials validated. Generating session ID...' 
        });

        // Convert entire creds.json to Base64
        const credsBase64 = Buffer.from(JSON.stringify(credsData)).toString('base64');
        credsId = credsBase64; // Use the Base64 encoded creds as session ID
        console.log(`✅ Generated Base64 session ID: ${credsId}`);

        // Save to local storage instead of MongoDB
        const now = new Date();
        sessionStorage.set(credsId, {
            sessionId: credsId,
            credsData: credsBase64,
            createdAt: now,
            updatedAt: now
        });

        console.log(`✅ Session saved locally: ${credsId}`);
        await Gifted.sendMessage(Gifted.user.id, { 
            text: '✅ Session ID generated successfully!' 
        });

        return credsId;

    } catch (error) {
        console.error('Error in saveSessionLocally:', {
            sessionId: credsId,
            tempId: id,
            error: error.message,
            stack: error.stack
        });

        // Send error notification to user
        try {
            await Gifted.sendMessage(Gifted.user.id, { 
                text: '❌ Credential encoding failed. Please try again.' 
            });
        } catch (msgError) {
            console.error('Failed to send error message:', msgError.message);
        }

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
    const id = trekkerId(); 
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

            Gifted.ev.on('creds.update', async (creds) => {
                console.log(`Credentials updated for session: ${id}`);
                await saveCreds();
                console.log(`Credentials saved to file system`);
            });

            // Flag to prevent multiple session processing
            let sessionProcessed = false;

            Gifted.ev.on("connection.update", async (s) => {
                const { connection, lastDisconnect } = s;

                if (connection === "open" && !sessionProcessed) {
                    sessionProcessed = true; // Set flag immediately to prevent duplicates
                    console.log(`Connection opened for pairing session: ${id}`);

                    try {
                        // Send initial confirmation to user
                        await Gifted.sendMessage(Gifted.user.id, { 
                            text: '🎉 WhatsApp connected successfully! Starting session generation...' 
                        });

                        console.log(`Waiting 5 seconds to ensure credentials are fully saved...`);
                        await delay(5000);

                        console.log('=== STARTING SESSION GENERATION ===');
                        console.log(`Session ID: ${id}`);

                        // Save session locally with notifications
                        const sessionId = await saveSessionLocally(id, Gifted);

                        if (!sessionId) {
                            console.error('❌ saveSessionLocally returned null - session generation failed');
                            await Gifted.sendMessage(Gifted.user.id, { 
                                text: 'Ultra fast..credits allowed.' 
                            });
                            throw new Error('Failed to save session locally');
                        }

                        console.log(`✅ Session generation successful: ${sessionId}`);

                        // Send the session ID
                        console.log(`Sending session ID to user: ${sessionId}`);
                        const session = await Gifted.sendMessage(Gifted.user.id, { text: sessionId });

                        // Send the creds.json file
                        console.log(`Sending creds.json file to user`);
                        const credsBuffer = Buffer.from(JSON.stringify(credsData, null, 2), 'utf8');
                        await Gifted.sendMessage(Gifted.user.id, { 
                            document: credsBuffer,
                            fileName: 'creds.json',
                            mimetype: 'application/json'
                        });

                        const TREKKER_TEXT = `
*✅sᴇssɪᴏɴ ɪᴅ ɢᴇɴᴇʀᴀᴛᴇᴅ✅*
______________________________
╔════◇
║『 𝐘𝐎𝐔'𝐕𝐄 𝐂𝐇𝐎𝐒𝐄𝐍 𝐓𝐑𝐄𝐊𝐊𝐄𝐑 𝐌𝐃 』
╚══════════════╝
╔═════◇
║ 『••• 𝗧𝗥𝗘𝗞𝗞𝗘𝗥 𝗠𝗗 𝗟𝗜𝗙𝗘𝗧𝗜𝗠𝗘 𝗕𝗢𝗧 •••』
║📱 WhatsApp: +254704897825
║💬 Telegram: @trekkermd
║👥 WhatsApp Group: Join Group
║📢 WhatsApp Channel: Follow Channel
║📸 Instagram: @nicholaso_tesla
║ 💜💜💜
╚══════════════╝ 
 𝗧𝗥𝗘𝗞𝗞𝗘𝗥-𝗠𝗗 𝗟𝗜𝗙𝗘𝗧𝗜𝗠𝗘 𝗕𝗢𝗧
______________________________

Use the Quoted Session ID to Deploy your Bot.
Your creds.json file has also been sent above.
Session stored locally for testing purposes.`;

                        await Gifted.sendMessage(Gifted.user.id, { text: TREKKER_TEXT }, { quoted: session });
                        console.log('Session ID and creds.json sent successfully to user');

                        // Immediate cleanup after messages are sent
                        console.log('🧹 Starting immediate cleanup...');
                        
                        // Clear session from storage immediately
                        if (sessionStorage.has(sessionId)) {
                            sessionStorage.delete(sessionId);
                            console.log(`🧹 Immediately cleared session: ${sessionId}`);
                        }

                        // Clear credentials file immediately
                        try {
                            const credsPath = path.join(__dirname, 'temp', id, 'creds.json');
                            if (fs.existsSync(credsPath)) {
                                fs.unlinkSync(credsPath);
                                console.log(`🧹 Cleared creds.json file: ${credsPath}`);
                            }
                        } catch (cleanupError) {
                            console.warn('Error clearing creds file:', cleanupError.message);
                        }

                        // Wait 60 seconds to ensure messages are delivered, then close connection
                        await delay(60000);
                        console.log('🧹 Closing connection and preparing for next session...');

                    } catch (err) {
                        // Reset flag on error so another attempt can be made if needed
                        sessionProcessed = false;
                        console.error('Error in connection update:', {
                            sessionId: id,
                            error: err.message,
                            stack: err.stack
                        });

                        // Try to send error message to user if possible
                        try {
                            if (Gifted.user?.id) {
                                await Gifted.sendMessage(Gifted.user.id, { 
                                    text: 'ultra fast bot by ttekker credits allowed'
                                });
                            }
                        } catch (msgError) {
                            console.error('Failed to send error message to user:', msgError.message);
                        }
                    } finally {
                        console.log(`🧹 Final cleanup for session: ${id}`);
                        
                        // Force close connection immediately
                        try {
                            if (Gifted.ws) {
                                Gifted.ws.close();
                                console.log('🔌 WebSocket connection closed');
                            }
                            if (Gifted.end) {
                                await Gifted.end();
                                console.log('🔌 Baileys connection ended');
                            }
                        } catch (closeError) {
                            console.warn('Error closing connection:', closeError.message);
                        }

                        // Complete cleanup of auth directory
                        try {
                            if (fs.existsSync(authDir)) {
                                await removeFile(authDir);
                                console.log(`🧹 Auth directory cleaned: ${authDir}`);
                            }
                        } catch (cleanupError) {
                            console.error('Error in final cleanup:', cleanupError.message);
                        }

                        // Clear any remaining session data
                        const tempSessionId = sessionStorage.get(id);
                        if (tempSessionId) {
                            sessionStorage.delete(id);
                            console.log(`🧹 Cleared any remaining session data for: ${id}`);
                        }

                        console.log('✅ System ready for next pairing session');
                    }
                } else if (connection === "open" && sessionProcessed) {
                    console.log(`Session already processed for ${id}, ignoring duplicate connection event`);
                    return;
                } else if (connection === "close" && lastDisconnect?.error?.output?.statusCode !== 401 && !sessionProcessed) {
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
