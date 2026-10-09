const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const axios = require('axios');
const cheerio = require('cheerio');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const cron = require('node-cron');

const serviceAccount = require('./serviceAccountKey.json');

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
});

client.on('qr', (qr) => {
  console.log('--- SCAN THIS QR CODE WITH WHATSAPP ---');
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  console.log('WhatsApp Bot is ready and active!');
});

client.initialize();

db.collection('users').onSnapshot((snapshot) => {
  snapshot.docChanges().forEach(async (change) => {
    if (change.type === 'added') {
      const newUser = change.doc.data();

      if (newUser.phone) {
        let phone = newUser.phone.replace(/[^0-9]/g, '');
        if (phone.startsWith('0')) phone = '94' + phone.substring(1);
        if (!phone.endsWith('@c.us')) phone = phone + '@c.us';

        const welcomeMsg = `👋 *CEYLON WEATHER* \n\nHello ${newUser.name}! You have successfully registered.\n📍 *Selected Reservoir:* ${newUser.reservoir || 'N/A'}\n🌐 *Language:* ${newUser.language || 'Sinhala'}\n\nYou will receive real-time alerts when reservoir conditions change.`;

        try {
          await client.sendMessage(phone, welcomeMsg);
          console.log(`Welcome message sent to ${newUser.name}`);
        } catch (err) {
          console.error('Welcome message error:', err.message);
        }
      }
    }
  });
}, (error) => {
  console.error('Firestore Snapshot Listener Error:', error.message);
});

async function checkAndSendReservoirAlerts() {
  console.log('Checking Irrigation Department for Detailed Reservoir Data...');
  try {
    const targetUrl = 'http://www.irrigation.gov.lk/'; 
    const { data } = await axios.get(targetUrl);
    const $ = cheerio.load(data);

    let reservoirDataList = [];

    $('table tr').each((i, el) => {
      const rowText = $(el).text().trim();
      if (rowText) {
        reservoirDataList.push(rowText);
      }
    });

    const fullScrapedContent = reservoirDataList.join(' | ');

    const alertRef = db.collection('alerts').doc('reservoir_detailed_latest');
    const lastDoc = await alertRef.get();

    if (!lastDoc.exists || lastDoc.data().content !== fullScrapedContent) {
      console.log('New Reservoir Alert Detected!');

      await alertRef.set({
        content: fullScrapedContent,
        timestamp: FieldValue.serverTimestamp()
      });

      const usersSnapshot = await db.collection('users').get();
      if (usersSnapshot.empty) {
        console.log('No registered users found.');
        return;
      }

      for (const userDoc of usersSnapshot.docs) {
        const user = userDoc.data(); 

        if (!user.phone || !user.reservoir) continue;

        let phone = user.phone.replace(/[^0-9]/g, '');
        if (phone.startsWith('0')) phone = '94' + phone.substring(1);
        if (!phone.endsWith('@c.us')) phone = phone + '@c.us';

        const userRes = user.reservoir.trim();
        const userLang = (user.language || 'Sinhala').toLowerCase();

        if (fullScrapedContent.toLowerCase().includes(userRes.toLowerCase())) {

          let cusecsRate = "12,500"; 
          let openedGates = "04";

          let messageBody = "";

          if (userLang.includes('sinhala') || userLang === 'si') {
            messageBody = 
`🚨 *CEYLON WEATHER - ජලාශ හදිසි පූර්ව අනතුරු ඇඟවීම* 🚨

👤 *නම:* ${user.name}
🏞️ *ජලාශය:* ${userRes}
🌊 *ජලය පිටවන වේගය (තත්පරයට ඝන අඩි):* ${cusecsRate} Cusecs
🚪 *විවෘත කළ වාන් දොරටු ගණන:* ${openedGates}
⚠️ *අවදානම් වර්ණය:* රතු (Red Alert - 🚨)

📢 *සැලකිලිමත් වන්න:* පහත් බිම්වල සිටින පිරිස් වහාම ආරක්ෂිත ස්ථාන වෙත යොමු වන්න!`;

          } else if (userLang.includes('tamil') || userLang === 'ta') {
            messageBody = 
`🚨 *CEYLON WEATHER - நீர்த்தேக்க அவசர எச்சரிக்கை* 🚨

👤 *பெயர்:* ${user.name}
🏞️ *நீர்த்தேக்கம்:* ${userRes}
🌊 *நீர் வெளியேற்ற வேகம் (விநாடிக்கு கன அடி):* ${cusecsRate} Cusecs
🚪 *திறக்கப்பட்ட வான் கதவுகளின் எண்ணிக்கை:* ${openedGates}
⚠️ *எச்சரிக்கை நிறம்:* சிவப்பு (Red Alert - 🚨)

📢 *கவனத்திற்கு:* தாழ்நிலப் பகுதிகளில் உள்ள மக்கள் உடனடியாக பாதுகாப்பான இடங்களுக்கு செல்லவும்!`;

          } else { 
            messageBody = 
`🚨 *CEYLON WEATHER - RESERVOIR EMERGENCY ALERT* 🚨

👤 *Name:* ${user.name}
🏞️ *Reservoir:* ${userRes}
🌊 *Discharge Rate (Cusecs):* ${cusecsRate} Cusecs
🚪 *Opened Spill Gates:* ${openedGates}
⚠️ *Alert Level / Color:* Red Alert (🚨)

📢 *Notice:* People in low-lying areas, please stay vigilant and take necessary precautions!`;
          }

          try {
            await client.sendMessage(phone, messageBody);
            console.log(`Alert sent to ${user.name} (${userRes}) in ${user.language}`);
          } catch (err) {
            console.error(`Failed sending to ${phone}:`, err.message);
          }
        }
      }
    } else {
      console.log('No new updates for reservoirs.');
    }

  } catch (error) {
    console.error('Scraping Error:', error.message);
  }
}

cron.schedule('* * * * *', () => {
  checkAndSendReservoirAlerts();
});