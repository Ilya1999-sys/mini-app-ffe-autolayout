const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { scoreAnswers, discountForScore } = require("../lib/quiz");
const { parsePromoTable } = require("../lib/promos");
const { validateInitData, choiceData, parseChoiceData, webhookSecret } = require("../lib/telegram");

const TOKEN = "123456:TEST_TOKEN";
const NOW = 1_800_000_000;

function initData(userId = 42, now = NOW, username) {
  const params = new URLSearchParams({ auth_date: String(now), user: JSON.stringify({ id: userId, first_name: "Тест", username }) });
  const checkString = [...params.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([key, value]) => `${key}=${value}`).join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update(TOKEN).digest();
  params.set("hash", crypto.createHmac("sha256", secret).update(checkString).digest("hex"));
  return params.toString();
}

function response() {
  return {
    statusCode: 200,
    headers: {},
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test("сервер сам считает баллы и отклоняет неполные ответы", () => {
  const correct = [1, 2, 2, 1, 2, 2, 1].map((selected, index) => ({ question: index + 1, selected, isCorrect: false }));
  assert.equal(scoreAnswers(correct), 7);
  assert.throws(() => scoreAnswers(correct.slice(1).concat(correct[1])), /Некорректный набор/);
  assert.throws(() => scoreAnswers(correct.slice(1)), /семь вопросов/);
});

test("скидка соответствует каждому результату от 0 до 7 баллов", () => {
  assert.deepEqual(Array.from({ length: 8 }, (_, score) => discountForScore(score)), [3, 5, 7, 10, 12, 15, 18, 20]);
  assert.throws(() => discountForScore(8), /Некорректное количество баллов/);
});

test("подпись Mini App привязана к пользователю и сроку действия", () => {
  assert.equal(validateInitData(initData(), TOKEN, NOW).id, 42);
  assert.throws(() => validateInitData(initData().replace("42", "43"), TOKEN, NOW), /подпись/);
  assert.throws(() => validateInitData(initData(42, NOW - 86401), TOKEN, NOW), /устарела/);
});

test("кнопка продукта подписана для пользователя и баллов", () => {
  const data = choiceData(42, "ux", 7, TOKEN, NOW);
  assert.ok(Buffer.byteLength(data) <= 64);
  assert.equal(parseChoiceData(data, 42, TOKEN, NOW).score, 7);
  assert.throws(() => parseChoiceData(data, 43, TOKEN, NOW), /подпись/);
  assert.throws(() => parseChoiceData(data.replace(":7:", ":6:"), 42, TOKEN, NOW), /подпись/);
});

test("CSV сопоставляет все восемь результатов и четыре продукта", () => {
  const header = "Баллы/Продукт,Курс для UX-редакторов,Базовый курс по Фигме,Курс для презентаций,Консультации";
  const csv = [header, ...Array.from({ length: 8 }, (_, score) =>
    `${score} баллов,UX${score},BASIC${score},SLIDES${score},CONSULT${score}`)].join("\r\n");
  const table = parsePromoTable(csv);
  assert.equal(table.get(7).get("slides"), "SLIDES7");
  assert.equal(table.get(0).get("consult"), "CONSULT0");
});

test("API теста отправляет кнопки в бот только после проверки initData", async () => {
  process.env.TELEGRAM_BOT_TOKEN = TOKEN;
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) });
    return { ok: true, json: async () => ({ ok: true, result: { message_id: 1 } }) };
  };
  try {
    const handler = require("../api/quiz");
    const answers = [1, 2, 2, 1, 2, 2, 1].map((selected, index) => ({ question: index + 1, selected }));
    const ok = response();
    await handler({ method: "POST", body: { initData: initData(42, Math.floor(Date.now() / 1000)), answers } }, ok);
    assert.equal(ok.statusCode, 200);
    assert.equal(ok.body.score, 7);
    assert.deepEqual(calls.map((call) => call.url.split("/").pop()), ["getWebhookInfo", "setWebhook", "sendMessage"]);
    assert.equal(calls[1].body.url, "https://mini-app-ffe-autolayout.vercel.app/api/telegram");
    assert.equal(calls[2].body.reply_markup.inline_keyboard.length, 4);

    const bad = response();
    await handler({ method: "POST", body: { initData: "forged", answers } }, bad);
    assert.equal(bad.statusCode, 400);
    assert.equal(calls.length, 3);
  } finally {
    global.fetch = originalFetch;
    delete process.env.TELEGRAM_BOT_TOKEN;
  }
});

test("вебхук отклоняет запрос без Telegram secret token", async () => {
  process.env.TELEGRAM_BOT_TOKEN = TOKEN;
  try {
    const handler = require("../api/telegram");
    const bad = response();
    await handler({ method: "POST", headers: {}, body: {} }, bad);
    assert.equal(bad.statusCode, 403);
    const ok = response();
    await handler({ method: "POST", headers: { "x-telegram-bot-api-secret-token": webhookSecret(TOKEN) }, body: {} }, ok);
    assert.equal(ok.statusCode, 200);
  } finally {
    delete process.env.TELEGRAM_BOT_TOKEN;
  }
});

test("автонастройка не заменяет вебхук другого приложения", async () => {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (url) => {
    calls.push(url.split("/").pop());
    return { ok: true, json: async () => ({ ok: true, result: { url: "https://other-app.vercel.app/api/telegram" } }) };
  };
  try {
    delete require.cache[require.resolve("../lib/telegram")];
    const { ensureWebhook } = require("../lib/telegram");
    await assert.rejects(ensureWebhook(TOKEN), /другой вебхук/);
    assert.deepEqual(calls, ["getWebhookInfo"]);
  } finally {
    global.fetch = originalFetch;
  }
});

test("бот отправляет промокод, скидку и адрес выбранного продукта", async () => {
  process.env.TELEGRAM_BOT_TOKEN = TOKEN;
  const originalFetch = global.fetch;
  const calls = [];
  const csv = [
    "Баллы/Продукт,Курс для UX-редакторов,Базовый курс по Фигме,Курс для презентаций,Консультации",
    ...Array.from({ length: 8 }, (_, score) => `${score} баллов,UX${score},BASIC${score},SLIDES${score},CONSULT${score}`),
  ].join("\n");
  global.fetch = async (url, options) => {
    if (url.includes("docs.google.com")) return { ok: true, text: async () => csv };
    calls.push({ method: url.split("/").pop(), body: JSON.parse(options.body) });
    return { ok: true, json: async () => ({ ok: true, result: true }) };
  };
  try {
    const handler = require("../api/telegram");
    const cases = [
      { product: "ux", score: 7, text: "Ваш промокод UX7 на скидку 20%. Переходите в курс: https://stepik.org/a/286605 и применяйте.", button: "Перейти в курс", url: "https://stepik.org/a/286605" },
      { product: "basic", score: 4, text: "Ваш промокод BASIC4 на скидку 12%. Переходите в курс: https://stepik.org/a/212750 и применяйте.", button: "Перейти в курс", url: "https://stepik.org/a/212750" },
      { product: "slides", score: 0, text: "Ваш промокод SLIDES0 на скидку 3%. Переходите в курс: https://stepik.org/a/233873 и применяйте.", button: "Перейти в курс", url: "https://stepik.org/a/233873" },
      { product: "consult", score: 6, text: "Ваш промокод CONSULT6 на скидку 18%. Пишите Илье в личку @ilya_uxui_design и договаривайтесь о времени консультации.", button: "Написать Илье", url: "https://t.me/ilya_uxui_design" },
    ];
    for (const [index, item] of cases.entries()) {
      const result = response();
      await handler({
        method: "POST",
        headers: { "x-telegram-bot-api-secret-token": webhookSecret(TOKEN) },
        body: { callback_query: {
          id: `callback-${index}`, from: { id: 42 },
          data: choiceData(42, item.product, item.score, TOKEN),
        } },
      }, result);
      assert.equal(result.statusCode, 200);
      const reply = calls[index * 2 + 1];
      assert.equal(reply.method, "sendMessage");
      assert.equal(reply.body.chat_id, 42);
      assert.equal(reply.body.text, item.text);
      assert.deepEqual(reply.body.reply_markup.inline_keyboard, [[{ text: item.button, url: item.url }]]);
    }
    assert.equal(calls.filter((call) => call.method === "answerCallbackQuery").length, cases.length);
  } finally {
    global.fetch = originalFetch;
    delete process.env.TELEGRAM_BOT_TOKEN;
  }
});

test("стартовое сообщение содержит текст и кнопку «Начать тест»", async () => {
  process.env.TELEGRAM_BOT_TOKEN = TOKEN;
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ method: url.split("/").pop(), body: JSON.parse(options.body) });
    return { ok: true, json: async () => ({ ok: true, result: true }) };
  };
  try {
    const handler = require("../api/telegram");
    const result = response();
    await handler({ method: "POST", headers: { "x-telegram-bot-api-secret-token": webhookSecret(TOKEN) },
      body: { message: { chat: { id: 42, type: "private" }, from: { id: 42 }, text: "/start" } } }, result);
    assert.equal(result.statusCode, 200);
    assert.match(calls[0].body.text, /Привет, это проект «Фигма для редакторов»!/);
    assert.match(calls[0].body.text, /не путать с Figma 😁/);
    assert.equal(calls[0].body.reply_markup.inline_keyboard[0][0].text, "Начать тест");
  } finally {
    global.fetch = originalFetch;
    delete process.env.TELEGRAM_BOT_TOKEN;
  }
});

test("повторный тест блокируется для Telegram ID, а /start показывает сохранённый результат", async () => {
  process.env.TELEGRAM_BOT_TOKEN = TOKEN;
  process.env.UPSTASH_REDIS_REST_URL = "https://redis.test";
  process.env.UPSTASH_REDIS_REST_TOKEN = "test-redis-token";
  const originalFetch = global.fetch;
  const calls = [];
  const store = new Map();
  global.fetch = async (url, options) => {
    const body = JSON.parse(options.body);
    if (url === "https://redis.test") {
      const [command, key, value] = body;
      if (command === "PING") return { ok: true, json: async () => ({ result: "PONG" }) };
      if (command === "GET") return { ok: true, json: async () => ({ result: store.get(key) ?? null }) };
      if (command === "SET") {
        const result = store.has(key) ? null : "OK";
        if (result) store.set(key, value);
        return { ok: true, json: async () => ({ result }) };
      }
    }
    calls.push({ method: url.split("/").pop(), body });
    const result = url.endsWith("getWebhookInfo") ? { url: "https://mini-app-ffe-autolayout.vercel.app/api/telegram" } : true;
    return { ok: true, json: async () => ({ ok: true, result }) };
  };
  try {
    const quiz = require("../api/quiz");
    const status = require("../api/status");
    const telegram = require("../api/telegram");
    const signed = initData(42, Math.floor(Date.now() / 1000));
    const health = response();
    await status({ method: "GET" }, health);
    assert.deepEqual(health.body, { configured: true, storageReady: true });
    const answers = [1, 2, 2, 1, 2, 2, 1].map((selected, index) => ({ question: index + 1, selected }));
    const before = response();
    await status({ method: "POST", body: { initData: signed } }, before);
    assert.deepEqual(before.body, { enforced: true, completed: false, score: null });

    const first = response();
    await quiz({ method: "POST", body: { initData: signed, answers } }, first);
    assert.equal(first.statusCode, 200);
    const second = response();
    await quiz({ method: "POST", body: { initData: signed, answers } }, second);
    assert.equal(second.statusCode, 409);
    assert.equal(calls.filter((call) => call.method === "sendMessage").length, 1);

    const after = response();
    await status({ method: "POST", body: { initData: signed } }, after);
    assert.deepEqual(after.body, { enforced: true, completed: true, score: 7 });

    const start = response();
    await telegram({ method: "POST", headers: { "x-telegram-bot-api-secret-token": webhookSecret(TOKEN) },
      body: { message: { chat: { id: 42, type: "private" }, from: { id: 42 }, text: "/start" } } }, start);
    assert.equal(start.statusCode, 200);
    const lastMessage = calls.filter((call) => call.method === "sendMessage").at(-1).body;
    assert.equal(lastMessage.text, "Результат теста: 7 из 7. Вам доступна скидка 20%. Выбирайте продукт, на который хотите получить промокод на скидку.");
    assert.equal(lastMessage.reply_markup.inline_keyboard.length, 4);
  } finally {
    global.fetch = originalFetch;
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  }
});

test("тестирующие по Telegram username проходят повторно через Mini App и бот", async () => {
  process.env.TELEGRAM_BOT_TOKEN = TOKEN;
  process.env.UPSTASH_REDIS_REST_URL = "https://redis.test";
  process.env.UPSTASH_REDIS_REST_TOKEN = "test-redis-token";
  const originalFetch = global.fetch;
  const calls = [];
  const storedScore = new Map([["ffe:autolayout:completed:42", "4"]]);
  global.fetch = async (url, options) => {
    const body = JSON.parse(options.body);
    if (url === "https://redis.test") {
      calls.push({ method: "redis", body });
      const [command, key, value] = body;
      if (command === "GET") return { ok: true, json: async () => ({ result: storedScore.get(key) ?? null }) };
      if (command === "SET") {
        const result = storedScore.has(key) ? null : "OK";
        if (result) storedScore.set(key, value);
        return { ok: true, json: async () => ({ result }) };
      }
    }
    const method = url.split("/").pop();
    calls.push({ method, body });
    const result = method === "getWebhookInfo" ? { url: "https://mini-app-ffe-autolayout.vercel.app/api/telegram" } : true;
    return { ok: true, json: async () => ({ ok: true, result }) };
  };
  try {
    const quiz = require("../api/quiz");
    const status = require("../api/status");
    const telegram = require("../api/telegram");
    const now = Math.floor(Date.now() / 1000);
    const answers = [1, 2, 2, 1, 2, 2, 1].map((selected, index) => ({ question: index + 1, selected }));
    for (const [id, username] of [[42, "ilya_uxui_design"], [43, "DM1017Y"], [44, "Olya25112"]]) {
      const signed = initData(id, now, username);
      const before = response();
      await status({ method: "POST", body: { initData: signed } }, before);
      assert.deepEqual(before.body, { enforced: false, completed: false, score: null });

      for (let attempt = 0; attempt < 2; attempt++) {
        const result = response();
        await quiz({ method: "POST", body: { initData: signed, answers } }, result);
        assert.equal(result.statusCode, 200);
        assert.equal(result.body.score, 7);
      }

      const start = response();
      await telegram({ method: "POST", headers: { "x-telegram-bot-api-secret-token": webhookSecret(TOKEN) },
        body: { message: { chat: { id, type: "private" }, from: { id, username }, text: "/start" } } }, start);
      assert.equal(start.statusCode, 200);
      assert.equal(calls.filter((call) => call.method === "sendMessage").at(-1).body.reply_markup.inline_keyboard[0][0].text, "Начать тест");
    }

    const keyboard = response();
    await telegram({ method: "POST", headers: { "x-telegram-bot-api-secret-token": webhookSecret(TOKEN) },
      body: { message: { chat: { id: 42, type: "private" }, from: { id: 42, username: "ilya_uxui_design" },
        web_app_data: { data: JSON.stringify({ answers }) } } } }, keyboard);
    assert.equal(keyboard.statusCode, 200);
    assert.match(calls.filter((call) => call.method === "sendMessage").at(-1).body.text, /Результат теста: 7 из 7/);
    assert.equal(calls.filter((call) => call.method === "redis").length, 0);
  } finally {
    global.fetch = originalFetch;
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  }
});
