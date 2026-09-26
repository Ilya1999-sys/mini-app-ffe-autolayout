const { scoreAnswers } = require("../lib/quiz");
const { getBotToken, validateInitData, ensureWebhook, sendProductChoices } = require("../lib/telegram");
const { claimCompletion } = require("../lib/attempts");

module.exports = async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "POST") return response.status(405).json({ error: "Метод не поддерживается" });
  let token;
  try {
    token = getBotToken();
  } catch {
    return response.status(503).json({ error: "Бот пока не подключен" });
  }

  let user;
  let score;
  try {
    const body = typeof request.body === "string" ? JSON.parse(request.body) : request.body;
    user = validateInitData(body?.initData, token);
    score = scoreAnswers(body?.answers);
  } catch (error) {
    return response.status(400).json({ error: error.message });
  }

  try {
    await ensureWebhook(token);
    const completion = await claimCompletion(user, score);
    if (!completion.claimed) {
      return response.status(409).json({ error: "Вы уже прошли тест. Откройте бот и отправьте /start, чтобы снова увидеть свой результат." });
    }
    await sendProductChoices(user.id, score, token);
    return response.status(200).json({ ok: true, score });
  } catch (error) {
    console.error("Не удалось отправить выбор продукта:", error.message);
    return response.status(502).json({ error: "Не удалось отправить сообщение в бот. Откройте бот и нажмите /start." });
  }
};
