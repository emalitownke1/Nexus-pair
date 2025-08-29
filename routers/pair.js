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

// Local storage for sessions instead of MongoDB
const sessionStorage = new Map();

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

            Gifted.ev.on('creds.update', async (creds) => {
                console.log(`Credentials updated for session: ${id}`);
                await saveCreds();
                console.log(`Credentials saved to file system`);
            });

            Gifted.ev.on("connection.update", async (s) => {
                const { connection, lastDisconnect } = s;

                if (connection === "open") {
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
                                text: '❌ Credential encoding failed. Please try again.' 
                            });
                            throw new Error('Failed to save session locally');
                        }

                        console.log(`✅ Session generation successful: ${sessionId}`);

                        // Send the session ID
                        console.log(`Sending session ID to user: ${sessionId}`);
                        const session = await Gifted.sendMessage(Gifted.user.id, { text: sessionId });

                        const GIFTED_TEXT = `
*✅sᴇssɪᴏɴ ɪᴅ ɢᴇɴᴇʀᴀᴛᴇᴅ✅*
______________________________
╔════◇
║『 𝐘𝐎𝐔'𝐕𝐄 𝐂𝐇𝐎𝐒𝐄𝐍 TREKKER_ND LIFETIME BOT  』
╚══════════════╝
╔═════◇
║ 『••• 𝗩𝗶𝘀𝗶𝘁 𝗙𝗼𝗿 𝗛𝗲𝗹𝗽 •••』
║❒ TELEGRAM:https://t.me/trekkermd_
║❒INSTAGRAM:https://www.instagram.com/nicholaso_tesla?igsh=eG5oNWVuNXF6eGU0_
║📞WhatsApp:+254704897825_
║❒ PairSite: _https://dc693d3f-99a0-4944-94cc-6b839418279c.e1-us-east-azure.choreoapps.dev/_
║❒ 𝐖𝐚𝐂𝐡𝐚𝐧𝐧𝐞𝐥: _https://whatsapp.com/channel/0029Vb6vpSv6WaKiG6ZIy73H_
║ 💜💜💜
╚══════════════╝ 
 DM the owner only for lifetime bot __No expiry__
______________________________

Use the Quoted Session ID to Deploy your Bot.
❤️Support us donations keeps this services running❤️

Powered by Trekker....ultra fast bot.`;

                        await Gifted.sendMessage(Gifted.user.id, { text: GIFTED_TEXT }, { quoted: session });
                        console.log('Session ID sent successfully to user');

                        // Clear all stored data and reset connections after successful session generation
                        console.log('🧹 Clearing all stored data and resetting connections...');
                        
                        // Clear the sessionStorage Map
                        sessionStorage.clear();
                        console.log('✅ SessionStorage cleared');
                        
                        // Close the WhatsApp connection immediately
                        try {
                            if (Gifted.ws && Gifted.ws.readyState === 1) {
                                await Gifted.ws.close();
                                console.log('✅ WhatsApp WebSocket connection closed');
                            }
                        } catch (closeError) {
                            console.warn('Warning: Error closing WebSocket:', closeError.message);
                        }
                        
                        // Clear any remaining authentication state
                        try {
                            if (Gifted.authState) {
                                Gifted.authState = null;
                                console.log('✅ Authentication state cleared');
                            }
                        } catch (authClearError) {
                            console.warn('Warning: Error clearing auth state:', authClearError.message);
                        }
                        
                        // Force cleanup of temp directory immediately
                        try {
                            if (fs.existsSync(authDir)) {
                                await removeFile(authDir);
                                console.log('✅ Temporary directory cleaned up');
                            }
                        } catch (cleanupError) {
                            console.warn('Warning: Error cleaning temp directory:', cleanupError.message);
                        }
                        
                        console.log('🎯 All data cleared and system reset to default state, ready for new requests');

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
                                    text: '❌ Credential encoding failed. Please try again.' 
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
