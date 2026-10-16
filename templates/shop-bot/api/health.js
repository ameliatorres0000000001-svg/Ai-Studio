// Health check used by the TeleScripts smoke test. Reports only whether each
// piece of configuration is present — never any value.
const data = require("../lib/data");

module.exports = (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({
    ok: true,
    telegram: !!process.env.TELEGRAM_BOT_TOKEN,
    webhookSecret: !!process.env.TELEGRAM_WEBHOOK_SECRET,
    data: data.configured(),
    admin: !!process.env.ADMIN_CHAT_ID,
  });
};
