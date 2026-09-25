const { getBotToken, validateInitData } = require("../lib/telegram");
const { attemptLimitEnabled, getCompletedScore } = require("../lib/attempts");

module.exports = async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "POST") return response.status(405).json({ error: "Метод не поддерживается" });
  let user;
  try {
    const body = typeof request.body === "string" ? JSON.parse(request.body) : request.body;
    user = validateInitData(body?.initData, getBotToken());
  } catch (error) {
    return response.status(400).json({ error: error.message });
  }
  try {
    const score = await getCompletedScore(user.id);
    return response.status(200).json({ enforced: attemptLimitEnabled(), completed: score !== null, score });
  } catch (error) {
    console.error("Не удалось проверить прохождение:", error.message);
    return response.status(503).json({ error: "Не удалось проверить прохождение. Попробуйте позже." });
  }
};
