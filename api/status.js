const { getBotToken, validateInitData } = require("../lib/telegram");
const { attemptLimitEnabled, checkAttemptStorage, getCompletedScore } = require("../lib/attempts");

module.exports = async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method === "GET") {
    try {
      const storageReady = await checkAttemptStorage();
      return response.status(storageReady ? 200 : 503).json({ storageReady });
    } catch (error) {
      console.error("Не удалось проверить хранилище попыток:", error.message);
      return response.status(503).json({ storageReady: false });
    }
  }
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
