const test = require("node:test");
const assert = require("node:assert/strict");
const { POLLS, pollForUtcDate } = require("../lib/channel-polls");
const handler = require("../api/channel-polls-cron");

function responseStub() {
  return {
    statusCode: 200,
    body: null,
    setHeader() {},
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

async function withRuntime(date, fetcher, action) {
  const RealDate = global.Date;
  const realFetch = global.fetch;
  const saved = Object.fromEntries(["CRON_SECRET", "TELEGRAM_BOT_TOKEN", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"]
    .map((key) => [key, process.env[key]]));
  global.Date = class extends RealDate {
    constructor(...args) { super(...(args.length ? args : [`${date}T07:25:00Z`])); }
    static now() { return new RealDate(`${date}T07:25:00Z`).getTime(); }
  };
  global.fetch = fetcher;
  Object.assign(process.env, {
    CRON_SECRET: "test-cron-secret",
    TELEGRAM_BOT_TOKEN: "test-token",
    UPSTASH_REDIS_REST_URL: "https://redis.example.test",
    UPSTASH_REDIS_REST_TOKEN: "test-redis-token",
  });
  try {
    await action();
  } finally {
    global.Date = RealDate;
    global.fetch = realFetch;
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function cronRequest(authorization = "Bearer test-cron-secret") {
  return {
    method: "GET",
    headers: {
      authorization,
      "x-vercel-cron-schedule": "25 7 * * 2",
    },
  };
}

test("six polls have unique Tuesday dates and valid Telegram lengths", () => {
  assert.equal(POLLS.length, 6);
  assert.equal(new Set(POLLS.map((poll) => poll.date)).size, 6);
  assert.deepEqual(POLLS.map((poll) => poll.date), [
    "2026-10-13", "2026-10-20", "2026-10-27",
    "2026-11-03", "2026-11-10", "2026-11-17",
  ]);
  assert.equal(pollForUtcDate("2026-10-13"), POLLS[0]);
  assert.equal(POLLS[0].question, "Немного редакторского интерактива: форма записывает на бесплатный разбор макета. Какая кнопка здесь понятнее?");
  assert.equal(pollForUtcDate("2026-10-14"), null);
  assert.equal(pollForUtcDate("2026-11-24"), null);
  assert.equal(pollForUtcDate("2026-12-01"), null);
});

test("cron rejects an unauthenticated request before network access", async () => {
  await withRuntime("2026-10-13", async () => { throw new Error("network should not be used"); }, async () => {
    const response = responseStub();
    await handler(cronRequest("Bearer wrong"), response);
    assert.equal(response.statusCode, 401);
  });
});

test("cron does nothing on Tuesdays without a planned poll", async () => {
  await withRuntime("2026-12-08", async () => { throw new Error("network should not be used"); }, async () => {
    const response = responseStub();
    await handler(cronRequest(), response);
    assert.deepEqual(response.body, { status: "no_poll", date: "2026-12-08" });
  });
});

test("a safe cron run before the first poll checks bot rights and Redis", async () => {
  const methods = [];
  const fakeFetch = async (url, options) => {
    const method = url === "https://redis.example.test" ? JSON.parse(options.body)[0] : url.split("/").at(-1);
    methods.push(method);
    const result = method === "getMe" ? { id: 123, username: "FigmaForEditors_bot" }
      : method === "getChatMember" ? { status: "administrator", can_post_messages: true }
      : "PONG";
    return { ok: true, json: async () => url === "https://redis.example.test" ? { result } : { ok: true, result } };
  };
  await withRuntime("2026-10-09", fakeFetch, async () => {
    const response = responseStub();
    await handler(cronRequest(), response);
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body, { status: "ready_no_poll", date: "2026-10-09" });
    assert.deepEqual(methods, ["getMe", "getChatMember", "PING"]);
  });
});

test("authenticated readiness check validates the bot and Redis without sending", async () => {
  const methods = [];
  const fakeFetch = async (url, options) => {
    const method = url === "https://redis.example.test" ? JSON.parse(options.body)[0] : url.split("/").at(-1);
    methods.push(method);
    const result = method === "getMe" ? { id: 123, username: "FigmaForEditors_bot" }
      : method === "getChatMember" ? { status: "administrator", can_post_messages: true }
      : "PONG";
    return { ok: true, json: async () => url === "https://redis.example.test" ? { result } : { ok: true, result } };
  };
  await withRuntime("2026-10-13", fakeFetch, async () => {
    const response = responseStub();
    await handler({ method: "GET", headers: { authorization: "Bearer test-cron-secret" }, query: { check: "1" } }, response);
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body, { status: "ready", channel: "@proeditor_figma" });
    assert.deepEqual(methods, ["getMe", "getChatMember", "PING"]);
  });
});

test("due poll is sent once and a repeat invocation is skipped", async () => {
  let claimed = false;
  const calls = [];
  const fakeFetch = async (url, options) => {
    const body = JSON.parse(options.body);
    if (url === "https://redis.example.test") {
      if (body[0] === "SET" && body[3] === "NX") {
        const result = claimed ? null : "OK";
        claimed = true;
        return { ok: true, json: async () => ({ result }) };
      }
      return { ok: true, json: async () => ({ result: "OK" }) };
    }
    const method = url.split("/").at(-1);
    calls.push({ method, body });
    const result = method === "getMe" ? { id: 123, username: "FigmaForEditors_bot" }
      : method === "getChatMember" ? { status: "administrator", can_post_messages: true }
      : method === "sendPoll" ? { message_id: 456 }
      : null;
    return { ok: true, json: async () => ({ ok: true, result }) };
  };

  await withRuntime("2026-10-13", fakeFetch, async () => {
    const first = responseStub();
    await handler(cronRequest(), first);
    assert.equal(first.statusCode, 200);
    assert.deepEqual(first.body, { status: "sent", date: "2026-10-13", message_id: 456 });
    assert.equal(calls.filter((call) => call.method === "sendPoll").length, 1);
    const payload = calls.find((call) => call.method === "sendPoll").body;
    assert.equal(payload.chat_id, "@proeditor_figma");
    assert.equal(payload.question, POLLS[0].question);
    assert.deepEqual(payload.options, POLLS[0].options.map((text) => ({ text })));
    assert.equal(payload.open_period, 6 * 24 * 60 * 60);

    const repeat = responseStub();
    await handler(cronRequest(), repeat);
    assert.deepEqual(repeat.body, { status: "already_claimed", date: "2026-10-13" });
    assert.equal(calls.filter((call) => call.method === "sendPoll").length, 1);
  });
});

test("bot without channel posting rights cannot claim or send a poll", async () => {
  const calls = [];
  const fakeFetch = async (url, options) => {
    if (url === "https://redis.example.test") throw new Error("must not claim a poll");
    const method = url.split("/").at(-1);
    calls.push(method);
    return { ok: true, json: async () => ({
      ok: true,
      result: method === "getMe" ? { id: 123, username: "FigmaForEditors_bot" }
        : { status: "member" },
    }) };
  };
  await withRuntime("2026-10-13", fakeFetch, async () => {
    const response = responseStub();
    await handler(cronRequest(), response);
    assert.equal(response.statusCode, 502);
    assert.deepEqual(calls, ["getMe", "getChatMember"]);
  });
});
