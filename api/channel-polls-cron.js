const { getBotToken, secureEquals, telegramApi } = require("../lib/telegram");
const { attemptLimitEnabled, redisCommand } = require("../lib/attempts");
const { BOT_USERNAME, CHANNEL_USERNAME, pollForUtcDate } = require("../lib/channel-polls");

const REQUIRED_SCHEDULE = "0 7 * * 2";

async function checkPostingRights(token) {
  const bot = await telegramApi("getMe", {}, token);
  if (bot.username?.toLowerCase() !== BOT_USERNAME.toLowerCase()) {
    throw new Error("Токен принадлежит другому боту");
  }
  const member = await telegramApi("getChatMember", {
    chat_id: CHANNEL_USERNAME,
    user_id: bot.id,
  }, token);
  if (member.status !== "creator" && !(member.status === "administrator" && member.can_post_messages === true)) {
    throw new Error("У бота нет права публиковать в канале");
  }
}

module.exports = async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "GET") return response.status(405).json({ error: "Метод не поддерживается" });
  const secret = process.env.CRON_SECRET;
  if (!secret) return response.status(503).json({ error: "CRON_SECRET не настроен" });
  if (!secureEquals(request.headers.authorization || "", `Bearer ${secret}`)) {
    return response.status(401).json({ error: "Доступ запрещён" });
  }
  if (request.query?.check === "1") {
    if (!attemptLimitEnabled()) return response.status(503).json({ error: "Redis не подключён" });
    try {
      await checkPostingRights(getBotToken());
      if ((await redisCommand("PING")) !== "PONG") throw new Error("Redis не ответил");
      return response.status(200).json({ status: "ready", channel: CHANNEL_USERNAME });
    } catch (error) {
      console.error("Проверка публикации опросов не удалась:", error.message);
      return response.status(502).json({ error: "Бот или Redis не готовы к публикации" });
    }
  }
  if (request.headers["x-vercel-cron-schedule"] !== REQUIRED_SCHEDULE) {
    return response.status(403).json({ error: "Неверное расписание" });
  }

  const today = new Date().toISOString().slice(0, 10);
  const poll = pollForUtcDate(today);
  if (!poll) {
    if (today > "2026-11-17") return response.status(200).json({ status: "no_poll", date: today });
    if (!attemptLimitEnabled()) return response.status(503).json({ error: "Redis не подключён" });
    try {
      await checkPostingRights(getBotToken());
      if ((await redisCommand("PING")) !== "PONG") throw new Error("Redis не ответил");
      return response.status(200).json({ status: "ready_no_poll", date: today });
    } catch (error) {
      console.error("Проверка публикации опросов не удалась:", error.message);
      return response.status(502).json({ error: "Бот или Redis не готовы к публикации" });
    }
  }
  if (!attemptLimitEnabled()) return response.status(503).json({ error: "Redis не подключён" });

  try {
    const token = getBotToken();
    await checkPostingRights(token);

    const key = `ffe:channel-poll:v1:${today}`;
    const claimed = await redisCommand("SET", key, "started", "NX");
    if (claimed !== "OK") return response.status(200).json({ status: "already_claimed", date: today });

    // A claimed poll is never retried automatically: a timeout after sendPoll
    // might otherwise publish the same poll twice. Inspect the channel first.
    const message = await telegramApi("sendPoll", {
      chat_id: CHANNEL_USERNAME,
      question: poll.question,
      options: poll.options.map((text) => ({ text })),
      is_anonymous: true,
      allows_multiple_answers: false,
      type: "regular",
      open_period: 6 * 24 * 60 * 60,
    }, token);
    await redisCommand("SET", key, `sent:${message.message_id}`);
    return response.status(200).json({ status: "sent", date: today, message_id: message.message_id });
  } catch (error) {
    console.error("Не удалось опубликовать опрос:", error.message);
    return response.status(502).json({ error: "Публикация не удалась; проверьте канал и состояние задачи" });
  }
};
