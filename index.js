const express = require("express");
const admin = require("firebase-admin");
const TelegramBot = require("node-telegram-bot-api");

// =========================
// ENVIRONMENT VARIABLES
// =========================

const BOT_TOKEN = process.env.BOT_TOKEN;
const FIREBASE_URL = process.env.FIREBASE_URL;
const ADMIN_ID = process.env.ADMIN_ID;

// =========================
// CHECK ENV
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

// =========================
// FIREBASE
// =========================

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  databaseURL: FIREBASE_URL
});

const db = admin.database();

// =========================
// EXPRESS
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

// =========================
// START COMMAND
// =========================

bot.onText(/^\/start(?:\s+(.+))?$/, async (msg, match) => {

  const userId = String(msg.from.id);

  const firstName = msg.from.first_name || "";
  const username = msg.from.username || "";

  const startParam = match && match[1]
    ? match[1]
    : null;

  const userRef = db.ref(`users/${userId}`);

  try {

    const snapshot = await userRef.once("value");

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

      // Referral count
      if (referredBy) {

        const referrerRef = db.ref(`users/${referredBy}`);

        const referrerSnapshot =
          await referrerRef.once("value");

        if (referrerSnapshot.exists()) {

          await referrerRef.child("referrals")
            .transaction(current => (current || 0) + 1);

        }

      }

    } else {

      await userRef.update({

        firstName: firstName,

        username: username,

        lastActive: Date.now()

      });

    }

    const keyboard = {

      inline_keyboard: [

        [
          {
            text: "🚀 Open TapEarn",
            web_app: {
              url: process.env.MINI_APP_URL ||
                "https://example.com"
            }
          }
        ],

        [
          {
            text: "👥 Invite Friends",
            callback_data: "invite"
          }
        ],

        [
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

    bot.sendMessage(
      userId,
      "❌ Something went wrong. Please try again later."
    );

  }

});

// =========================
// BALANCE BUTTON
// =========================

bot.on("callback_query", async (query) => {

  const userId = String(query.from.id);

  try {

    if (query.data === "balance") {

      const snapshot =
        await db.ref(`users/${userId}`).once("value");

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
          text: `💰 Balance: ${user.coins || 0} coins`
        }
      );

    }

    // =========================
    // INVITE
    // =========================

    if (query.data === "invite") {

      const botUsername =
        process.env.BOT_USERNAME || "TapEarnBot";

      const inviteLink =
        `https://t.me/${botUsername}?start=${userId}`;

      await bot.sendMessage(

        userId,

        `👥 Invite Friends\n\n` +
        `Share your referral link:\n\n` +
        `${inviteLink}\n\n` +
        `🎁 Invite friends and grow your earnings!`

      );

      await bot.answerCallbackQuery(query.id);

    }

  } catch (error) {

    console.error("CALLBACK ERROR:", error);

  }

});

// =========================
// ADMIN BROADCAST FOUNDATION
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
    `এই command-এর full broadcast panel আমরা পরের ধাপে তৈরি করব.\n\n` +
    `বর্তমানে Firebase users database প্রস্তুত আছে।`

  );

});

// =========================
// SERVER
// =========================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {

  console.log(
    `TapEarn server running on port ${PORT}`
  );

});
