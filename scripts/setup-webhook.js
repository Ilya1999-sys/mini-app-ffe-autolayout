const { APP_URL, BOT_USERNAME, getBotToken, webhookSecret, telegramApi } = require("../lib/telegram");

async function main() {
  const token = getBotToken();
  const expectedUrl = new URL("api/telegram", APP_URL).toString();
  const [bot, current] = await Promise.all([
    telegramApi("getMe", {}, token),
    telegramApi("getWebhookInfo", {}, token),
  ]);

  if (bot.username?.toLowerCase() !== BOT_USERNAME.toLowerCase()) {
    throw new Error(`Токен принадлежит @${bot.username}, ожидался @${BOT_USERNAME}`);
  }

  console.log(`Бот: @${bot.username}`);
  console.log(`Текущий вебхук: ${current.url || "не установлен"}`);
  console.log(`Новый вебхук: ${expectedUrl}`);

  if (!process.argv.includes("--install")) {
    console.log("Для установки запустите команду с --install.");
    return;
  }
  if (current.url && current.url !== expectedUrl) {
    throw new Error("У бота уже настроен другой вебхук. Проверьте его обработчик перед заменой.");
  }

  await telegramApi("setWebhook", {
    url: expectedUrl,
    secret_token: webhookSecret(token),
    allowed_updates: ["message", "callback_query"],
  }, token);
  const installed = await telegramApi("getWebhookInfo", {}, token);
  if (installed.url !== expectedUrl) throw new Error("Telegram не подтвердил адрес вебхука");
  console.log("Вебхук установлен. Проверьте /start и прохождение теста в Telegram.");
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
