const express = require('express');
const fs = require('fs');
const path = require('path');
const pino = require("pino");
require('dotenv').config();

const { giftedId, removeFile } = require('../lib');
const {
    default: Gifted_Tech,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers
} = require("@whiskeysockets/baileys");

const router = express.Router();
const sessionStorage = new Map();
const activeConnections = new Map();

// Session cleanup utility
async function cleanupSession(sessionId, connection = null, authDir = null) {
    console.log(`🧹 Starting cleanup for session: ${sessionId}`);
    
    try {
        // Remove from active connections
        if (activeConnections.has(sessionId)) {
            activeConnections.delete(sessionId);
        }

        // Close WhatsApp connection
        if (connection) {
            try {
                if (connection.ev) {
                    connection.ev.removeAllListeners();
                    console.log(`✅ Event listeners removed for session: ${sessionId}`);
                }
                
                if (connection.ws && connection.ws.readyState === 1) {
                    await connection.ws.close();
                    console.log(`✅ WebSocket closed for session: ${sessionId}`);
                }
                
                if (connection.authState) {
                    connection.authState = null;
                    console.log(`✅ Auth state cleared for session: ${sessionId}`);
                }
            } catch (connError) {
                console.warn(`Warning during connection cleanup for ${sessionId}:`, connError.message);
            }
        }

        // Remove temp directory
        if (authDir && fs.existsSync(authDir)) {
            await removeFile(authDir);
            console.log(`✅ Temp directory removed for session: ${sessionId}`);
        }

        console.log(`🎯 Cleanup completed for session: ${sessionId}`);
    } catch (error) {
        console.error(`❌ Error during cleanup for session ${sessionId}:`, error.message);
    }
}

// Save session credentials locally
async function saveSessionLocally(sessionId, connection) {
    const authPath = path.join(__dirname, 'temp', sessionId, 'creds.json');
    
    try {
        console.log(`📝 Saving session locally: ${sessionId}`);
        
        // Send status update
        await connection.sendMessage(connection.user.id, { 
            text: '🔄 Processing session credentials...' 
        });

        // Verify credentials file exists
        if (!fs.existsSync(authPath)) {
            throw new Error(`Credentials file not found: ${authPath}`);
        }

        // Read and parse credentials
        const rawData = fs.readFileSync(authPath, 'utf8');
        const credsData = JSON.parse(rawData);
        
        if (!credsData || typeof credsData !== 'object') {
            throw new Error('Invalid credentials data format');
        }

        // Convert to Base64 session ID
        const sessionBase64 = Buffer.from(JSON.stringify(credsData)).toString('base64');
        
        // Store in memory
        sessionStorage.set(sessionBase64, {
            sessionId: sessionBase64,
            credsData: sessionBase64,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        await connection.sendMessage(connection.user.id, { 
            text: '✅ Session ID generated successfully!' 
        });

        console.log(`✅ Session saved locally: ${sessionId}`);
        return sessionBase64;

    } catch (error) {
        console.error(`❌ Error saving session ${sessionId}:`, error.message);
        
        try {
            await connection.sendMessage(connection.user.id, { 
                text: '❌ Failed to generate session. Please try again.' 
            });
        } catch (msgError) {
            console.error('Failed to send error message:', msgError.message);
        }
        
        return null;
    }
}

// Main pairing route
router.get('/', async (req, res) => {
    const sessionId = giftedId();
    let phoneNumber = req.query.number;

    // Validate phone number
    if (!phoneNumber) {
        return res.status(400).send({ error: "Phone number is required" });
    }

    // Clean phone number
    phoneNumber = phoneNumber.replace(/[^0-9]/g, '');
    
    const authDir = path.join(__dirname, 'temp', sessionId);
    let connection = null;
    let forceCleanupTimer = null;

    console.log(`🚀 Starting pairing process for session: ${sessionId}`);

    try {
        // Create temp directory
        if (!fs.existsSync(authDir)) {
            fs.mkdirSync(authDir, { recursive: true });
        }

        // Set up 4-minute force cleanup timer
        forceCleanupTimer = setTimeout(async () => {
            console.log(`⏰ 4-minute timeout reached for session: ${sessionId}`);
            await cleanupSession(sessionId, connection, authDir);
            sessionStorage.clear();
            console.log(`🎯 Force cleanup completed for session: ${sessionId}`);
        }, 4 * 60 * 1000);

        // Initialize WhatsApp connection
        const { state, saveCreds } = await useMultiFileAuthState(authDir);
        
        connection = Gifted_Tech({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
            },
            printQRInTerminal: false,
            logger: pino({ level: "fatal" }),
            browser: Browsers.macOS("Safari")
        });

        // Store active connection
        activeConnections.set(sessionId, connection);

        // Request pairing code if not registered
        if (!connection.authState.creds.registered) {
            await delay(1500);
            const pairingCode = await connection.requestPairingCode(phoneNumber);
            console.log(`Pairing code for ${phoneNumber}: ${pairingCode}`);
            
            if (!res.headersSent) {
                res.send({ code: pairingCode });
            }
        }

        // Handle credential updates
        connection.ev.on('creds.update', async () => {
            try {
                if (fs.existsSync(authDir)) {
                    await saveCreds();
                    console.log(`Credentials updated for session: ${sessionId}`);
                }
            } catch (saveError) {
                console.warn(`Credential save warning for ${sessionId}:`, saveError.message);
            }
        });

        // Handle connection updates
        connection.ev.on("connection.update", async (update) => {
            const { connection: connState, lastDisconnect } = update;

            if (connState === "open") {
                console.log(`✅ WhatsApp connected for session: ${sessionId}`);

                try {
                    // Send confirmation
                    await connection.sendMessage(connection.user.id, { 
                        text: '🎉 WhatsApp connected successfully! Starting session generation...' 
                    });

                    // Wait longer for credentials to be fully saved
                    console.log(`Waiting 5 seconds to ensure credentials are fully saved...`);
                    await delay(5000);

                    console.log('=== STARTING SESSION GENERATION ===');
                    console.log(`Session ID: ${sessionId}`);

                    // Generate session
                    const generatedSessionId = await saveSessionLocally(sessionId, connection);
                    
                    if (!generatedSessionId) {
                        console.error('❌ saveSessionLocally returned null - session generation failed');
                        await connection.sendMessage(connection.user.id, { 
                            text: '❌ Credential encoding failed. Please try again.' 
                        });
                        throw new Error('Failed to save session locally');
                    }

                    console.log(`✅ Session generation successful: ${generatedSessionId}`);

                    // Send session ID to user
                    console.log(`Sending session ID to user: ${generatedSessionId}`);
                    const sessionMessage = await connection.sendMessage(connection.user.id, { 
                        text: generatedSessionId 
                    });

                    // Send success message with contact info
                    const successText = `
*✅ SESSION ID GENERATED ✅*
______________________________
╔════◇
║『 TREKKER-MD LIFETIME BOT 』
╚══════════════╝
╔═════◇
║ 『••• Visit For Help •••』
║❒ TELEGRAM: https://t.me/trekkermd_
║❒ INSTAGRAM: https://www.instagram.com/nicholaso_tesla
║📞 WhatsApp: +254704897825
║❒ Channel: https://whatsapp.com/channel/0029Vb6vpSv6WaKiG6ZIy73H
║ 💜💜💜
╚══════════════╝ 

Use the session ID above to deploy your bot.
❤️ Support keeps this service running ❤️

Powered by TREKKER-MD....ultra fast bot.`;

                    await connection.sendMessage(connection.user.id, { 
                        text: successText 
                    }, { quoted: sessionMessage });

                    console.log('Session ID sent successfully to user');

                    // Clear all stored data and reset connections after successful session generation
                    console.log('🧹 Clearing all stored data and resetting connections...');
                    
                    // Clear the sessionStorage Map
                    sessionStorage.clear();
                    console.log('✅ SessionStorage cleared');

                    // Clear timeout and perform cleanup
                    if (forceCleanupTimer) {
                        clearTimeout(forceCleanupTimer);
                        console.log('⏰ 4-minute cleanup timer cancelled - normal cleanup completed');
                    }
                    
                    await cleanupSession(sessionId, connection, authDir);
                    console.log('🎯 All data cleared and system reset to default state, ready for new requests');

                } catch (error) {
                    console.error(`❌ Error in session generation for ${sessionId}:`, error.message);
                    
                    try {
                        if (connection.user?.id) {
                            await connection.sendMessage(connection.user.id, { 
                                text: '❌ Credential encoding failed. Please try again.' 
                            });
                        }
                    } catch (msgError) {
                        console.error('Failed to send error message to user:', msgError.message);
                    }
                } finally {
                    console.log(`Cleaning up connection for session: ${sessionId}`);
                    await delay(100);

                    try {
                        if (connection.ws && connection.ws.readyState === 1) {
                            await connection.ws.close();
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

            } else if (connState === "close" && lastDisconnect?.error?.output?.statusCode !== 401) {
                console.log(`🔄 Connection closed for ${sessionId}, retrying in 10 seconds...`);
                await delay(10000);
                
                // Restart the pairing process
                async function restartPairing() {
                    try {
                        console.log(`🔄 Restarting pairing process for session: ${sessionId}`);
                        
                        // Re-initialize WhatsApp connection
                        const { state: newState, saveCreds: newSaveCreds } = await useMultiFileAuthState(authDir);
                        
                        const newConnection = Gifted_Tech({
                            auth: {
                                creds: newState.creds,
                                keys: makeCacheableSignalKeyStore(newState.keys, pino({ level: "fatal" })),
                            },
                            printQRInTerminal: false,
                            logger: pino({ level: "fatal" }),
                            browser: Browsers.macOS("Safari")
                        });

                        // Update connection reference
                        connection = newConnection;
                        activeConnections.set(sessionId, newConnection);

                        // Re-add event listeners
                        newConnection.ev.on('creds.update', async () => {
                            try {
                                if (fs.existsSync(authDir)) {
                                    await newSaveCreds();
                                    console.log(`Credentials updated for session: ${sessionId}`);
                                }
                            } catch (saveError) {
                                console.warn(`Credential save warning for ${sessionId}:`, saveError.message);
                            }
                        });

                        // Re-add this same connection.update listener
                        newConnection.ev.on("connection.update", arguments.callee);

                    } catch (restartError) {
                        console.error(`Error restarting pairing for ${sessionId}:`, restartError.message);
                    }
                }
                
                restartPairing().catch(err => console.error('Error in restart pairing:', err.message));
            }
        });

    } catch (error) {
        console.error(`❌ Service error for session ${sessionId}:`, error.message);
        
        // Clear timeout
        if (forceCleanupTimer) {
            clearTimeout(forceCleanupTimer);
        }
        
        // Cleanup on error
        await cleanupSession(sessionId, connection, authDir);
        
        if (!res.headersSent) {
            res.status(500).send({ error: "Service temporarily unavailable" });
        }
    }
});

module.exports = router;