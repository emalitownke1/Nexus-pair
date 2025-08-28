# TREKKER-MD Session Generator
- Private repository - Repository is private for security purposes
- Deploy to your favourite hosting server eg Heroku or Render or self hosting
- This is what I use in my Session Site so don't ask for more...

<details>
<summary>SAMPLE USAGE IN BOT</summary>
   
```js
// 1. IN YOUR LIB OR SOMEWHERE YOU LIKE:
const fs = require('fs'),
      path = require('path'), 
      axios = require('axios'),
      sessionDir = path.join(__dirname, 'session'),
      credsPath = path.join(sessionDir, 'creds.json'),
      createDirIfNotExist = dir => !fs.existsSync(dir) && fs.mkdirSync(dir, { recursive: true });

createDirIfNotExist(sessionDir);

const SESSIONS_BASE_URL = 'https://creds.giftedtech.web.id'; // Your Backened Url Here
const SESSIONS_API_KEY = ''; // Must Match one of your Backened ApiKeys

async function loadSession() {
  try {
    if (!config.SESSION_ID) {
      console.log('No SESSION_ID Provided - Using QR Code Authentication');
      return true;
    }

    const credsId = config.SESSION_ID;

    if (!credsId.startsWith('Gifted~')) {
      console.log('Invalid SESSION_ID: It must start with "Gifted~"');
      return false;
    }

    const sessionDir = path.join(__dirname, '../session');
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    const response = await axios.get(`${SESSIONS_BASE_URL}/api/downloadCreds.php/${credsId}`, {
      headers: {
        'x-api-key': SESSIONS_API_KEY
      }
    });

    if (!response.data.credsData) {
      throw new Error('No sessionData Received from Server');
    }

    const credsPath = path.join(sessionDir, 'creds.json');
    fs.writeFileSync(credsPath, JSON.stringify(response.data.credsData), 'utf8');
    console.log('Session Loaded ✅');
    return response.data.credsData;
  } catch (error) {
    console.error('Error loading session:', error.response?.data || error.message);
    return null;
  }
}

module.exports = { loadSession }


// 2. IN YOUR BOT START FILE(INDEX.JS/CLIENT.JS):
const { loadSession } = require("./lib");
// Other things....
async function ConnectGiftedToWA() {
  await loadSession();
console.log('⏱️ Conneting Gifted Md ⏱️')
const { state, saveCreds } = await useMultiFileAuthState(__dirname + '/session/')
var { version, isLatest } = await fetchLatestBaileysVersion()

const Gifted = GiftedConnect({
        logger: P({ level: 'silent' }),
        printQRInTerminal: !config.SESSION_ID, // Continue your functions......


```

</details>

<details>
<summary>MORE INFO</summary>
   
<strong>NB:</strong> This repo also generates session ID for all bots using gifted-baileys/whiskeysockets/baileys but with ***mongodb*** storage.

WEB - PAIR CODE FOR BOTS WITH GIFTED-BAILEYS

<p align="center">
    <img src="https://files.catbox.moe/52699c.jpg" width="500">
</p>

</details>



...TREKKER MD LIFETIME BOT Integration

📱 WhatsApp: +254704897825

💬 Telegram: @trekkermd

👥 WhatsApp Group: Join Group

📢 WhatsApp Channel: Follow Channel

📸 Instagram: @nicholaso_tesla



<details>
<summary>DEPLOYMENT</summary>
 
<a href='https://dashboard.heroku.com' target="_blank"><img alt='HEROKU DEPLOY' src='https://img.shields.io/badge/-HEROKU DEPLOY-black?style=for-the-badge&logo=heroku&logoColor=white'/>
 <br>
<a href='https://dashboard.render.com' target="_blank">
    <img alt='DEPLOY TO RENDER' src='https://img.shields.io/badge/-DEPLOY TO RENDER-black?style=for-the-badge&logo=render&logoColor=white'/>
</a>
 <br>
<a href='https://app.koyeb.com' target="_blank">
    <img alt='DEPLOY TO KOYEB' src='https://img.shields.io/badge/-DEPLOY TO KOYEB-black?style=for-the-badge&logo=koyeb&logoColor=white'/>
</a>

</details>

# `Owner`

TREKKER MD LIFETIME BOT

📱 WhatsApp: +254704897825
💬 Telegram: @trekkermd
📸 Instagram: @nicholaso_tesla

   
