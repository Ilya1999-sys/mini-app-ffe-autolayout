const { scoreAnswers } = require("../lib/quiz");
const { getPromoCode } = require("../lib/promos");
const {
  APP_URL, getBotToken, secureEquals, webhookSecret, parseChoiceData,
  telegramApi, sendProductChoices,
} = require("../lib/telegram");

async function handleMessage(message, token) {
  if (message.chat?.type !== "private" || !Number.isSafeInteger(message.from?.id)) return;

  if (message.web_app_data?.data) {
    try {
      const payload = JSON.parse(message.web_app_data.data);
      const score = scoreAnswers(payload.answers);
      await sendProductChoices(message.from.id, score, token);
    } catch {
      await telegramApi("sendMessage", {
        chat_id: message.chat.id,
        text: "Не удалось прочитать результат. Откройте тест ещё раз.",
      }, token);
    }
    return;
  }

  if (typeof message.text === "string" && message.text.startsWith("/start")) {
    await telegramApi("sendMessage", {
      chat_id: message.chat.id,
      text: "Пройдите тест по Auto Layout, чтобы получить промокод.",
      reply_markup: { inline_keyboard: [[{ text: "Открыть тест", web_app: { url: APP_URL } }]] },
    }, token);
  }
}

async function handleCallback(query, token) {
  let choice;
  try {
    choice = parseChoiceData(query.data, query.from?.id, token);
  } catch {
    await telegramApi("answerCallbackQuery", {
      callback_query_id: query.id,
      text: "Кнопка устарела. Пройдите тест ещё раз.",
      show_alert: true,
    }, token);
    return;
  }

  await telegramApi("answerCallbackQuery", { callback_query_id: query.id }, token);
  try {
    const code = await getPromoCode(choice.score, choice.product.id);
    await telegramApi("sendMessage", {
      chat_id: query.from.id,
      text: `${choice.product.label}\nПромокод: ${code}`,
      reply_markup: { inline_keyboard: [[{ text: "Открыть продукт", url: choice.product.url }]] },
    }, token);
  } catch (error) {
    console.error("Не удалось получить промокод:", error.message);
    await telegramApi("sendMessage", {
      chat_id: query.from.id,
      text: "Промокод временно недоступен. Попробуйте нажать кнопку продукта позже.",
    }, token);
  }
}

module.exports = async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "POST") return response.status(405).json({ error: "Метод не поддерживается" });
  let token;
  try {
    token = getBotToken();
  } catch {
    return response.status(503).json({ error: "Бот пока не подключен" });
  }
  if (!secureEquals(request.headers["x-telegram-bot-api-secret-token"] || "", webhookSecret(token))) {
    return response.status(403).json({ error: "Доступ запрещён" });
  }

  try {
    const update = typeof request.body === "string" ? JSON.parse(request.body) : request.body;
    if (update?.callback_query) await handleCallback(update.callback_query, token);
    else if (update?.message) await handleMessage(update.message, token);
    return response.status(200).json({ ok: true });
  } catch (error) {
    console.error("Ошибка обработки Telegram update:", error.message);
    return response.status(500).json({ error: "Ошибка обработки сообщения" });
  }
};
