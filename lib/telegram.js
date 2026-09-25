const crypto = require("node:crypto");
const { PRODUCTS } = require("./catalog");

const BOT_USERNAME = "FigmaForEditors_bot";
const APP_URL = "https://mini-app-ffe-autolayout.vercel.app/";
const MAX_INIT_DATA_AGE_SECONDS = 24 * 60 * 60;
const MAX_CHOICE_AGE_SECONDS = 30 * 24 * 60 * 60;
const WEBHOOK_URL = new URL("api/telegram", APP_URL).toString();
let webhookConfigured = false;

function getBotToken() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN не настроен");
  return token;
}

function secureEquals(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function validateInitData(raw, token, now = Math.floor(Date.now() / 1000)) {
  if (typeof raw !== "string" || raw.length < 20 || raw.length > 8192) throw new Error("Нет данных Telegram");
  const params = new URLSearchParams(raw);
  const seen = new Set();
  for (const key of params.keys()) {
    if (seen.has(key)) throw new Error("Повторяются поля Telegram");
    seen.add(key);
  }
  const hash = params.get("hash");
  const authDate = Number(params.get("auth_date"));
  if (!hash || !/^[a-f0-9]{64}$/i.test(hash)) throw new Error("Нет подписи Telegram");
  if (!Number.isSafeInteger(authDate) || authDate > now + 60 || now - authDate > MAX_INIT_DATA_AGE_SECONDS) {
    throw new Error("Сессия Telegram устарела");
  }
  const checkString = [...params.entries()]
    .filter(([key]) => key !== "hash")
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update(token).digest();
  const expected = crypto.createHmac("sha256", secret).update(checkString).digest("hex");
  if (!secureEquals(expected, hash.toLowerCase())) throw new Error("Неверная подпись Telegram");

  let user;
  try {
    user = JSON.parse(params.get("user") || "null");
  } catch {
    throw new Error("Некорректный пользователь Telegram");
  }
  if (!user || !Number.isSafeInteger(user.id) || user.id <= 0 || user.is_bot) {
    throw new Error("Нет пользователя Telegram");
  }
  return user;
}

function webhookSecret(token) {
  return crypto.createHmac("sha256", token).update("ffe-autolayout-webhook").digest("base64url");
}

function choiceSignature(userId, productId, score, issuedAt, token) {
  return crypto.createHmac("sha256", token)
    .update(`${userId}:${productId}:${score}:${issuedAt}`)
    .digest("base64url")
    .slice(0, 16);
}

function choiceData(userId, productId, score, token, now = Math.floor(Date.now() / 1000)) {
  const issuedAt = now.toString(36);
  const signature = choiceSignature(userId, productId, score, issuedAt, token);
  return `p:${productId}:${score}:${issuedAt}:${signature}`;
}

function parseChoiceData(data, userId, token, now = Math.floor(Date.now() / 1000)) {
  const match = /^p:(ux|basic|slides|consult):([0-7]):([0-9a-z]+):([A-Za-z0-9_-]{16})$/.exec(data || "");
  if (!match) throw new Error("Неверный выбор продукта");
  const [, productId, scoreText, issuedAt, signature] = match;
  const created = Number.parseInt(issuedAt, 36);
  if (!Number.isSafeInteger(created) || created > now + 60 || now - created > MAX_CHOICE_AGE_SECONDS) {
    throw new Error("Кнопка выбора устарела");
  }
  const expected = choiceSignature(userId, productId, scoreText, issuedAt, token);
  if (!secureEquals(expected, signature)) throw new Error("Неверная подпись выбора");
  return { product: PRODUCTS.find((item) => item.id === productId), score: Number(scoreText) };
}

async function telegramApi(method, data, token = getBotToken()) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(10000),
  });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(`Telegram ${method}: ${result.description || response.status}`);
  return result.result;
}

async function ensureWebhook(token = getBotToken()) {
  if (webhookConfigured) return;
  const current = await telegramApi("getWebhookInfo", {}, token);
  if (current.url && current.url !== WEBHOOK_URL) {
    throw new Error("У бота уже настроен другой вебхук");
  }
  await telegramApi("setWebhook", {
    url: WEBHOOK_URL,
    secret_token: webhookSecret(token),
    allowed_updates: ["message", "callback_query"],
  }, token);
  webhookConfigured = true;
}

function productKeyboard(userId, score, token) {
  return {
    inline_keyboard: PRODUCTS.map((product) => [{
      text: product.label,
      callback_data: choiceData(userId, product.id, score, token),
    }]),
  };
}

async function sendProductChoices(userId, score, token = getBotToken()) {
  return telegramApi("sendMessage", {
    chat_id: userId,
    text: `Результат теста: ${score} из 7. Выбирайте продукт, на который хотите получить промокод на скидку`,
    reply_markup: productKeyboard(userId, score, token),
  }, token);
}

module.exports = {
  APP_URL, BOT_USERNAME, getBotToken, secureEquals, validateInitData, webhookSecret,
  choiceData, parseChoiceData, telegramApi, ensureWebhook, productKeyboard, sendProductChoices,
};
