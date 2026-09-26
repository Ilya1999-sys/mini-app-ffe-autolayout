const { scoreAnswers, discountForScore } = require("../lib/quiz");
const { getPromoCode } = require("../lib/promos");
const { getCompletedScore, claimCompletion } = require("../lib/attempts");
const {
  APP_URL, getBotToken, secureEquals, webhookSecret, parseChoiceData,
  telegramApi, sendProductChoices,
} = require("../lib/telegram");

async function handleMessage(message, token) {
  if (message.chat?.type !== "private" || !Number.isSafeInteger(message.from?.id)) return;

  if (message.web_app_data?.data) {
    let score;
    try {
      const payload = JSON.parse(message.web_app_data.data);
      score = scoreAnswers(payload.answers);
    } catch {
      await telegramApi("sendMessage", {
        chat_id: message.chat.id,
        text: "Не удалось прочитать результат. Откройте тест ещё раз.",
      }, token);
      return;
    }
    try {
      const completion = await claimCompletion(message.from, score);
      if (!completion.claimed) {
        await telegramApi("sendMessage", {
          chat_id: message.chat.id,
          text: "Вы уже прошли тест. Отправьте /start, чтобы снова увидеть свой результат и выбрать продукт.",
        }, token);
        return;
      }
      await sendProductChoices(message.from.id, score, token);
    } catch (error) {
      console.error("Не удалось сохранить результат:", error.message);
      await telegramApi("sendMessage", {
        chat_id: message.chat.id,
        text: "Не удалось сохранить результат. Попробуйте позже.",
      }, token);
    }
    return;
  }

  if (typeof message.text === "string" && message.text.startsWith("/start")) {
    const completedScore = await getCompletedScore(message.from);
    if (completedScore !== null) {
      await sendProductChoices(message.from.id, completedScore, token);
      return;
    }
    await telegramApi("sendMessage", {
      chat_id: message.chat.id,
      text: "Привет, это проект «Фигма для редакторов»!\nСегодня мы хотим, чтобы вы проверили свои знания автолейаута и получили скидки на наши продукты.\n\nЕсли готовы, то жмите кнопку «Начать тест» и знакомьтесь с Figa (не путать с Figma 😁)",
      reply_markup: { inline_keyboard: [[{ text: "Начать тест", web_app: { url: APP_URL } }]] },
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
    const discount = discountForScore(choice.score);
    const isConsultation = choice.product.id === "consult";
    await telegramApi("sendMessage", {
      chat_id: query.from.id,
      text: isConsultation
        ? `Ваш промокод ${code} на скидку ${discount}%. Пишите Илье в личку @ilya_uxui_design и договаривайтесь о времени консультации.`
        : `Ваш промокод ${code} на скидку ${discount}%. Переходите в курс: ${choice.product.url} и применяйте.`,
      reply_markup: { inline_keyboard: [[{
        text: isConsultation ? "Написать Илье" : "Перейти в курс",
        url: choice.product.url,
      }]] },
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
