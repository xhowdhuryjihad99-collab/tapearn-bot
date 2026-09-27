const express = require("express");
const admin = require("firebase-admin");
const TelegramBot = require("node-telegram-bot-api");

// =========================
// ENVIRONMENT VARIABLES
// =========================

const BOT_TOKEN = process.env.BOT_TOKEN;
const BOT_USERNAME = process.env.BOT_USERNAME;
const FIREBASE_URL = process.env.FIREBASE_URL;
const ADMIN_ID = process.env.ADMIN_ID;
const FIREBASE_SERVICE_ACCOUNT = process.env.FIREBASE_SERVICE_ACCOUNT;

// =========================
// CHECK ENVIRONMENT
// =========================

if (!BOT_TOKEN) {
  console.error("BOT_TOKEN is missing");
  process.exit(1);
}

if (!FIREBASE_URL) {
  console.error("FIREBASE_URL is missing");
  process.exit(1);
}

if (!ADMIN_ID) {
  console.error("ADMIN_ID is missing");
  process.exit(1);
}

if (!FIREBASE_SERVICE_ACCOUNT) {
  console.error("FIREBASE_SERVICE_ACCOUNT is missing");
  process.exit(1);
}

// =========================
// FIREBASE
// =========================

let serviceAccount;

try {
  serviceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT);
} catch (error) {
  console.error("Invalid FIREBASE_SERVICE_ACCOUNT JSON");
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: FIREBASE_URL
});

const db = admin.database();

console.log("Firebase connected successfully");

// =========================
// EXPRESS SERVER
// =========================

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "TapEarn Bot is running!"
  });
});

// =========================
// TELEGRAM BOT
// =========================

const bot = new TelegramBot(BOT_TOKEN, {
  polling: true
});

console.log("Telegram bot started");

// =========================
// START COMMAND
// =========================

bot.onText(/^\/start(?:\s+(.+))?$/, async (msg, match) => {

  const userId = String(msg.from.id);

  const firstName = msg.from.first_name || "";
  const username = msg.from.username || "";

  const startParam =
    match && match[1] ? match[1] : null;

  const userRef = db.ref(`users/${userId}`);

  try {

    const snapshot = await userRef.once("value");

    // =========================
    // NEW USER
    // =========================

    if (!snapshot.exists()) {

      let referredBy = null;

      if (startParam && startParam !== userId) {
        referredBy = startParam;
      }

      await userRef.set({

        userId: userId,

        firstName: firstName,

        username: username,

        coins: 0,

        energy: 1000,

        maxEnergy: 1000,

        tapPower: 1,

        profitPerHour: 0,

        referrals: 0,

        referredBy: referredBy,

        createdAt: Date.now(),

        lastEnergyUpdate: Date.now(),

        lastActive: Date.now()

      });

      // =========================
      // REFERRAL
      // =========================

      if (referredBy) {

        const referrerRef =
          db.ref(`users/${referredBy}`);

        const referrerSnapshot =
          await referrerRef.once("value");

        if (referrerSnapshot.exists()) {

          await referrerRef
            .child("referrals")
            .transaction(current =>
              (current || 0) + 1
            );

        }

      }

    } else {

      // =========================
      // EXISTING USER
      // =========================

      await userRef.update({

        firstName: firstName,

        username: username,

        lastActive: Date.now()

      });

    }

    // =========================
    // BOT MENU
    // =========================

    const keyboard = {

      inline_keyboard: [

        [
          {
            text: "🚀 Open TapEarn",

            web_app: {
              url:
                process.env.MINI_APP_URL ||
                "https://example.com"
            }

          }
        ],

        [
          {
            text: "👥 Invite Friends",
            callback_data: "invite"
          },

          {
            text: "💰 Balance",
            callback_data: "balance"
          }
        ]

      ]

    };

    await bot.sendMessage(

      userId,

      `🎉 Welcome to TapEarn, ${firstName || "Friend"}!\n\n` +

      `👆 Tap and earn coins\n` +

      `⚡ Upgrade your power\n` +

      `👥 Invite friends\n` +

      `💰 Build your balance\n\n` +

      `Start earning now! 🚀`,

      {
        reply_markup: keyboard
      }

    );

  } catch (error) {

    console.error("START ERROR:", error);

    try {

      await bot.sendMessage(
        userId,
        "❌ Something went wrong. Please try again later."
      );

    } catch (sendError) {

      console.error(
        "MESSAGE ERROR:",
        sendError
      );

    }

  }

});

// =========================
// CALLBACK BUTTONS
// =========================

bot.on("callback_query", async (query) => {

  const userId = String(query.from.id);

  try {

    // =========================
    // BALANCE
    // =========================

    if (query.data === "balance") {

      const snapshot =
        await db.ref(`users/${userId}`)
          .once("value");

      const user = snapshot.val();

      if (!user) {

        await bot.answerCallbackQuery(
          query.id,
          {
            text: "Please use /start first."
          }
        );

        return;

      }

      await bot.answerCallbackQuery(

        query.id,

        {
          text:
            `💰 Balance: ${user.coins || 0} coins`
        }

      );

    }

    // =========================
    // INVITE
    // =========================

    if (query.data === "invite") {

      const botUsername =
        BOT_USERNAME || "TapEarnBot";

      const inviteLink =
        `https://t.me/${botUsername}?start=${userId}`;

      await bot.sendMessage(

        userId,

        `👥 Invite Friends\n\n` +

        `🔗 Your referral link:\n\n` +

        `${inviteLink}\n\n` +

        `🎁 Invite friends and grow your earnings!`

      );

      await bot.answerCallbackQuery(
        query.id
      );

    }

  } catch (error) {

    console.error(
      "CALLBACK ERROR:",
      error
    );

  }

});

// =========================
// ADMIN BROADCAST
// =========================

bot.onText(/^\/broadcast$/, async (msg) => {

  const userId = String(msg.from.id);

  if (userId !== String(ADMIN_ID)) {

    await bot.sendMessage(
      userId,
      "⛔ You are not authorized."
    );

    return;

  }

  await bot.sendMessage(

    userId,

    `📢 Broadcast System\n\n` +

    `Broadcast panel will be added in the next step.\n\n` +

    `👥 Users database is ready.`

  );

});

// =========================
// ERROR HANDLING
// =========================

bot.on("polling_error", (error) => {

  console.error(
    "Telegram polling error:",
    error.message
  );

});

// =========================
// SERVER START
// =========================

const PORT =
  process.env.PORT || 3000;

app.listen(PORT, () => {

  console.log(
    `TapEarn server running on port ${PORT}`
  );

});
