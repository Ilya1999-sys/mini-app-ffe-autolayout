const KEY_PREFIX = "ffe:autolayout:completed:";

function attemptLimitEnabled() {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

async function redisCommand(...command) {
  if (!attemptLimitEnabled()) throw new Error("Хранилище попыток не подключено");
  const response = await fetch(process.env.UPSTASH_REDIS_REST_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(10000),
  });
  const result = await response.json();
  if (!response.ok || result.error) throw new Error(`Хранилище попыток: ${result.error || response.status}`);
  return result.result;
}

function keyFor(userId) {
  if (!Number.isSafeInteger(userId) || userId <= 0) throw new Error("Некорректный Telegram ID");
  return `${KEY_PREFIX}${userId}`;
}

async function checkAttemptStorage() {
  if (!attemptLimitEnabled()) return false;
  return (await redisCommand("PING")) === "PONG";
}

async function getCompletedScore(userId) {
  if (!attemptLimitEnabled()) return null;
  const value = await redisCommand("GET", keyFor(userId));
  if (value === null) return null;
  const score = Number(value);
  if (!Number.isInteger(score) || score < 0 || score > 7) throw new Error("Некорректный сохранённый результат");
  return score;
}

async function claimCompletion(userId, score) {
  if (!attemptLimitEnabled()) return { claimed: true, enforced: false };
  if (!Number.isInteger(score) || score < 0 || score > 7) throw new Error("Некорректный результат");
  const result = await redisCommand("SET", keyFor(userId), String(score), "NX");
  return { claimed: result === "OK", enforced: true };
}

module.exports = { attemptLimitEnabled, checkAttemptStorage, getCompletedScore, claimCompletion };
