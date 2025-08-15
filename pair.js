if (connection == "open") {
    await delay(5000);
    let data = fs.readFileSync(__dirname + `/temp/${id}/creds.json`);
    let rf = __dirname + `/temp/${id}/creds.json`;

    function generateRandomText() {
        const prefix = "3EB";
        const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let randomText = prefix;
        for (let i = prefix.length; i < 22; i++) {
            const randomIndex = Math.floor(Math.random() * characters.length);
            randomText += characters.charAt(randomIndex);
        }
        return randomText;
    }
    const randomText = generateRandomText();

    try {
        const { upload } = require('./mega');
        const mega_url = await upload(fs.createReadStream(rf), `${sock.user.id}.json`);
        const string_session = mega_url.replace('https://mega.nz/file/', '');
        let md = "nexus~" + string_session;

        // Send pairing code text
        let codeMsg = await sock.sendMessage(sock.user.id, { text: md });

        // AUDIO (PTT) with view-channel + fake verified contact
        const audioUrl = "https://files.catbox.moe/abcd123.mp3"; // badilisha na link ya audio yako
        await sock.sendMessage(sock.user.id, {
            audio: { url: audioUrl },
            mimetype: 'audio/mp4',
            ptt: true,
            contextInfo: {
                forwardedNewsletterMessageInfo: {
                    newsletterJid: "120363300010990664@newsletter", // channel ID yako
                    newsletterName: "PK-XMD Official",
                    serverMessageId: null
                },
                externalAdReply: {
                    title: "✅ Bot Successfully Paired",
                    body: "Welcome to PK-XMD!",
                    thumbnailUrl: "https://i.postimg.cc/3RrYq2xP/28ed8a29-7bae-4747-b11c-1fd04d0ee9bf.jpg",
                    sourceUrl: "https://whatsapp.com/channel/0029Va8lZBRJSeBjLquJ8a3e",
                    mediaType: 1,
                    renderLargerThumbnail: true
                }
            }
        }, {
            quoted: {
                key: {
                    fromMe: false,
                    participant: '0@s.whatsapp.net',
                    remoteJid: 'status@broadcast'
                },
                message: {
                    contactMessage: {
                        displayName: "WhatsApp",
                        vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:WhatsApp\nORG:WhatsApp;\nTEL;type=CELL;type=VOICE;waid=0:+0\nEND:VCARD`
                    }
                }
            }
        });

        // Send follow-up text with channel link
        let desc = `*Hello there NEXUS-AI User! 👋🏻* 

> Do not share your session id with your gf 😂.

*Thanks for using NEXUS-AI 🇰🇪*

> Join WhatsApp Channel :- ⤵️
https://whatsapp.com/channel/0029Vad7YNyJuyA77CtIPX0x

> *© Powered BY PKDRILLER 💙*`; 

        await sock.sendMessage(sock.user.id, {
            text: desc,
            contextInfo: {
                externalAdReply: {
                    title: "Pkdriller",
                    thumbnailUrl: "https://i.postimg.cc/3RrYq2xP/28ed8a29-7bae-4747-b11c-1fd04d0ee9bf.jpg",
                    sourceUrl: "https://whatsapp.com/channel/0029Vad7YNyJuyA77CtIPX0x",
                    mediaType: 1,
                    renderLargerThumbnail: true
                }
            }
        }, { quoted: codeMsg });

    } catch (e) {
        let errMsg = await sock.sendMessage(sock.user.id, { text: e });
        let desc = `*Don't Share with anyone this code use for deploy KANGO-XMD*\n\n ◦ *Github:* https://github.com/OfficialKango/KANGO-XMD`;
        await sock.sendMessage(sock.user.id, {
            text: desc,
            contextInfo: {
                externalAdReply: {
                    title: "PK-XMD",
                    thumbnailUrl: "https://i.postimg.cc/3RrYq2xP/28ed8a29-7bae-4747-b11c-1fd04d0ee9bf.jpg",
                    sourceUrl: "https://whatsapp.com/channel/0029Vad7YNyJuyA77CtIPX0x",
                    mediaType: 2,
                    renderLargerThumbnail: true,
                    showAdAttribution: true
                }
            }
        }, { quoted: errMsg });
}
                    
