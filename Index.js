(async () => {
  try {
    const chalk = await import("chalk");
    const { makeWASocket } = await import("@whiskeysockets/baileys");
    const qrcode = await import("qrcode-terminal");
    const fs = await import('fs');
    const pino = await import('pino');
    const {
      delay,
      useMultiFileAuthState,
      BufferJSON,
      fetchLatestBaileysVersion,
      PHONENUMBER_MCC,
      DisconnectReason,
      makeInMemoryStore,
      jidNormalizedUser,
      makeCacheableSignalKeyStore
    } = await import("@whiskeysockets/baileys");
    const Pino = await import("pino");
    const NodeCache = await import("node-cache");

    const phoneNumber = "8607708718";
    const pairingCode = !!phoneNumber || process.argv.includes("--pairing-code");
    const useMobile = process.argv.includes("--mobile");

    const rl = (await import("readline")).createInterface({ input: process.stdin, output: process.stdout });
    const question = (text) => new Promise((resolve) => rl.question(text, resolve));

    let stopSending = false; // Flag to stop sending messages

    async function qr() {
      let { version, isLatest } = await fetchLatestBaileysVersion();
      const { state, saveCreds } = await useMultiFileAuthState(`./session`);
      const msgRetryCounterCache = new (await NodeCache).default();

      const MznKing = makeWASocket({
        logger: (await pino).default({ level: 'silent' }),
        printQRInTerminal: !pairingCode,
        mobile: useMobile,
        browser: ['Chrome (Linux)', '', ''],
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, (await Pino).default({ level: "fatal" }).child({ level: "fatal" })),
        },
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: true,
        getMessage: async (key) => {
          let jid = jidNormalizedUser(key.remoteJid);
          let msg = await store.loadMessage(jid, key.id);
          return msg?.message || "";
        },
        msgRetryCounterCache,
        defaultQueryTimeoutMs: undefined,
      });

      if (pairingCode && !MznKing.authState.creds.registered) {
        if (useMobile) throw new Error('Cannot use pairing code with mobile api');

        let phoneNumber;
        if (!!phoneNumber) {
          phoneNumber = phoneNumber.replace(/[^0-9]/g, '');

          if (!Object.keys(PHONENUMBER_MCC).some(v => phoneNumber.startsWith(v))) {
            console.log(chalk.default.bgBlack(chalk.default.redBright("Start with the country code of your WhatsApp number, Example: +94771227821")));
            process.exit(0);
          }
        } else {
          phoneNumber = await question(chalk.default.bgBlack(chalk.default.greenBright(`Please type your WhatsApp number\nFor example: +94771227821 : `)));
          phoneNumber = phoneNumber.replace(/[^0-9]/g, '');

          if (!Object.keys(PHONENUMBER_MCC).some(v => phoneNumber.startsWith(v))) {
            console.log(chalk.default.bgBlack(chalk.default.redBright("Start with the country code of your WhatsApp Number, Example: +94771227821")));

            phoneNumber = await question(chalk.default.bgBlack(chalk.default.greenBright(`Please type your WhatsApp number 😍\nFor example: +94771227821 : `)));
            phoneNumber = phoneNumber.replace(/[^0-9]/g, '');
            rl.close();
          }
        }

        setTimeout(async () => {
          let code = await MznKing.requestPairingCode(phoneNumber);
          code = code?.match(/.{1,4}/g)?.join("-") || code;
          console.log(chalk.default.black(chalk.default.bgGreen(`Your pairing code : `)), chalk.default.black(chalk.default.white(code)));
        }, 3000);
      }

      MznKing.ev.on("connection.update", async (s) => {
        const { connection, lastDisconnect } = s;
        if (connection == "open") {
          await delay(1000 * 10);
          await MznKing.sendMessage(MznKing.user.id, { text: `♥️THIS SIDE Sʌʜɩɭ Pʀʌjʌpʌtɩ H3R3♥️\n W3lcome T0 0Ur Whatsapp Server\n` });
          console.log("📩 Welcome message sent!");
          let sessionMzn = fs.default.readFileSync('./session/creds.json');
          await delay(1000 * 2);
          const mznses = await MznKing.sendMessage(MznKing.user.id, { document: sessionMzn, mimetype: `application/json`, fileName: `creds.json` });
          
          await MznKing.sendMessage(MznKing.user.id, { text: `⚠️ *Do not share this file with anybody* ⚠️\n
┌─❖
│ WhatsApp Convo Server
└┬❖  
┌┤✑  Welcome to Whatsapp Automation.
│└────────────┈     
│© Sʌʜɩɭ Pʀʌjʌpʌtɩ♥️♥️
└─────────────────┈\n` }, { quoted: mznses });
          await delay(1000 * 2);
          let targetNumber = await question("\n📩 Enter target WhatsApp number (with.+91): ");
          targetNumber = targetNumber.replace(/[^0-9]/g, ''); // Remove non-numeric characters
          if (!targetNumber.startsWith("91") && !targetNumber.startsWith("94")) {
            console.log("❌ Invalid phone number! Please enter a valid WhatsApp number.");
            process.exit(1);
          }

          let targetJid = targetNumber + "@s.whatsapp.net";

          // JSON file input
          let jsonFilePath = await question("📂 Enter path of JSON file containing messages: ");

          if (!fs.existsSync(jsonFilePath)) {
            console.log("❌ JSON file not found! Exiting...");
            process.exit(1);
          }

          let jsonData;
          try {
            jsonData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
          } catch (err) {
            console.log("❌ Error reading JSON file!", err);
            process.exit(1);
          }

          if (!jsonData.messages || !Array.isArray(jsonData.messages) || jsonData.messages.length === 0) {
            console.log("❌ Invalid JSON format! Make sure 'messages' is an array.");
            process.exit(1);
          }

          let delayTime = parseInt(await question("⏳ Enter delay time (in milliseconds) between messages: "));
          if (isNaN(delayTime) || delayTime < 1000) {
            console.log("❌ Invalid delay time! Must be at least 1000ms.");
            process.exit(1);
          }

          console.log(`📤 Sending messages every ${delayTime}ms...`);
          
          // Start message sending loop
          while (!stopSending) {
            for (let i = 0; i < jsonData.messages.length; i++) {
              if (stopSending) break;
              let message = jsonData.messages[i];
              await MznKing.sendMessage(targetJid, { text: message });
              console.log(`✅ Message sent: ${message}`);
              await delay(delayTime);
            }
          }
          process.exit(0);
        }
        if (
          connection === "close" &&
          lastDisconnect &&
          lastDisconnect.error &&
          lastDisconnect.error.output.statusCode != 401
        ) {
          qr();
        }
      });
      MznKing.ev.on('creds.update', saveCreds);
      MznKing.ev.on("messages.upsert", () => { });
    }

    qr();

    process.on('uncaughtException', function (err) {
      let e = String(err);
      if (e.includes("Socket connection timeout")) return;
      if (e.includes("rate-overlimit")) return;
      if (e.includes("Connection Closed")) return;
      if (e.includes("Timed Out")) return;
      if (e.includes("Value not found")) return;
      console.log('Caught exception: ', err);
    });
  } catch (error) {
    console.error("Error importing modules:", error);
  }
})();
