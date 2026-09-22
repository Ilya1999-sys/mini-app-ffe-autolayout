const TOTAL_QUESTIONS = 7;

const SPRITE = {
  imageUrl: "./assets/figma-sprite.png",
  width: 2061,
  height: 8924,
};

// Coordinates from Figma section screenshot (node 3:172).
// The screenshot includes 40px padding around the selection.
const PAD = 40;
const frame = (x, y) => ({ x: x + PAD, y: y + PAD, w: 390, h: 844 });

const frames = {
  welcome: frame(156, 545),
  questions: [
    frame(585, 545),
    frame(585, 1475),
    frame(585, 2405),
    frame(585, 3335),
    frame(585, 4265),
    frame(585, 5195),
    frame(585, 6125),
  ],
  success: [
    frame(1006, 545),
    frame(1006, 1475),
    frame(1006, 2405),
    frame(1006, 3335),
    frame(1006, 4265),
    frame(1006, 5195),
    frame(1006, 6125),
  ],
  lost: [
    frame(1435, 545),
    frame(1435, 1475),
    frame(1435, 2405),
    frame(1435, 3335),
    frame(1435, 4265),
    frame(1435, 5195),
    frame(1435, 6125),
  ],
  final: frame(585, 7018),
};

const questions = [
  { correctIndex: 0, options: [{ x: 16, y: 164, w: 358, h: 164 }, { x: 16, y: 340, w: 358, h: 172 }] },
  { correctIndex: 1, options: [{ x: 16, y: 164, w: 358, h: 250 }, { x: 16, y: 426, w: 358, h: 210 }] },
  { correctIndex: 1, options: [{ x: 16, y: 188, w: 358, h: 182 }, { x: 16, y: 382, w: 358, h: 122 }] },
  { correctIndex: 0, options: [{ x: 16, y: 164, w: 358, h: 278 }, { x: 16, y: 454, w: 358, h: 106 }] },
  { correctIndex: 1, options: [{ x: 16, y: 164, w: 358, h: 144 }, { x: 16, y: 320, w: 358, h: 172 }] },
  { correctIndex: 1, options: [{ x: 16, y: 188, w: 358, h: 152 }, { x: 16, y: 350, w: 358, h: 110 }] },
  { correctIndex: 0, options: [{ x: 16, y: 164, w: 358, h: 152 }, { x: 16, y: 326, w: 358, h: 152 }] },
];

const buttonHitboxes = {
  welcomeStart: { x: 16, y: 776, w: 358, h: 52 },
  answer: { x: 16, y: 776, w: 358, h: 52 },
  next: { x: 16, y: 776, w: 358, h: 52 },
  finalBenefit: { x: 16, y: 776, w: 358, h: 52 },
};

const state = {
  screen: "welcome", // welcome | question | result | final
  questionIndex: 0,
  selectedOptionIndex: null,
  score: 0,
  answers: [],
  lastWasCorrect: false,
};

const screenNode = document.getElementById("screen");

function getTelegramApp() {
  if (window.Telegram && window.Telegram.WebApp) return window.Telegram.WebApp;
  return null;
}

function initTelegram() {
  const tg = getTelegramApp();
  if (!tg) return;
  tg.ready();
  tg.expand();
}

function createFrameLayer(frameRect) {
  const layer = document.createElement("div");
  layer.className = "frame-layer";
  layer.style.backgroundImage = `url(${SPRITE.imageUrl})`;
  layer.style.backgroundSize = `${SPRITE.width}px ${SPRITE.height}px`;
  layer.style.backgroundPosition = `-${frameRect.x}px -${frameRect.y}px`;
  return layer;
}

function createHotspot({ x, y, w, h }, onClick, className = "hotspot") {
  const el = document.createElement("button");
  el.type = "button";
  el.className = className;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.style.width = `${w}px`;
  el.style.height = `${h}px`;
  if (onClick) el.addEventListener("click", onClick);
  return el;
}

function createSelectedOverlay(box) {
  const el = document.createElement("div");
  el.className = "selected-overlay";
  el.style.left = `${box.x}px`;
  el.style.top = `${box.y}px`;
  el.style.width = `${box.w}px`;
  el.style.height = `${box.h}px`;
  return el;
}

function render() {
  screenNode.innerHTML = "";
  if (state.screen === "welcome") renderWelcome();
  if (state.screen === "question") renderQuestion();
  if (state.screen === "result") renderResult();
  if (state.screen === "final") renderFinal();
}

function renderWelcome() {
  const wrap = document.createElement("div");
  wrap.className = "screen-wrap";
  wrap.appendChild(createFrameLayer(frames.welcome));
  wrap.appendChild(
    createHotspot(buttonHitboxes.welcomeStart, () => {
      state.screen = "question";
      render();
    }),
  );
  screenNode.appendChild(wrap);
}

function renderQuestion() {
  const question = questions[state.questionIndex];
  const wrap = document.createElement("div");
  wrap.className = "screen-wrap";
  wrap.appendChild(createFrameLayer(frames.questions[state.questionIndex]));

  question.options.forEach((optionBox, idx) => {
    wrap.appendChild(
      createHotspot(optionBox, () => {
        state.selectedOptionIndex = idx;
        render();
      }, "hotspot answer-hitbox"),
    );
  });

  if (state.selectedOptionIndex !== null) {
    wrap.appendChild(createSelectedOverlay(question.options[state.selectedOptionIndex]));
  }

  const answerButton = createHotspot(buttonHitboxes.answer, () => {
    if (state.selectedOptionIndex === null) return;
    const isCorrect = state.selectedOptionIndex === question.correctIndex;
    state.lastWasCorrect = isCorrect;
    if (isCorrect) state.score += 1;
    state.answers.push({
      question: state.questionIndex + 1,
      selected: state.selectedOptionIndex + 1,
      correct: question.correctIndex + 1,
      isCorrect,
    });
    state.screen = "result";
    render();
  });

  answerButton.disabled = state.selectedOptionIndex === null;
  wrap.appendChild(answerButton);

  if (state.selectedOptionIndex === null) {
    const disabledShade = document.createElement("div");
    disabledShade.className = "button-disabled-shade";
    disabledShade.style.left = `${buttonHitboxes.answer.x}px`;
    disabledShade.style.top = `${buttonHitboxes.answer.y}px`;
    disabledShade.style.width = `${buttonHitboxes.answer.w}px`;
    disabledShade.style.height = `${buttonHitboxes.answer.h}px`;
    disabledShade.textContent = "Ответ";
    wrap.appendChild(disabledShade);
  }

  screenNode.appendChild(wrap);
}

function renderResult() {
  const wrap = document.createElement("div");
  wrap.className = "screen-wrap";
  const source = state.lastWasCorrect ? frames.success : frames.lost;
  wrap.appendChild(createFrameLayer(source[state.questionIndex]));

  wrap.appendChild(
    createHotspot(buttonHitboxes.next, () => {
      if (state.questionIndex === TOTAL_QUESTIONS - 1) {
        state.screen = "final";
        render();
        return;
      }
      state.questionIndex += 1;
      state.selectedOptionIndex = null;
      state.screen = "question";
      render();
    }),
  );

  screenNode.appendChild(wrap);
}

function renderFinal() {
  const wrap = document.createElement("div");
  wrap.className = "screen-wrap";
  wrap.appendChild(createFrameLayer(frames.final));

  // Hide hardcoded "7 баллов" text from screenshot and overlay dynamic score.
  const scoreMask = document.createElement("div");
  scoreMask.className = "score-mask";
  wrap.appendChild(scoreMask);

  const scoreText = document.createElement("p");
  scoreText.className = "score-overlay";
  scoreText.textContent = `${state.score} баллов`;
  wrap.appendChild(scoreText);

  wrap.appendChild(
    createHotspot(buttonHitboxes.finalBenefit, () => {
      const tg = getTelegramApp();
      const payload = {
        type: "quiz_result",
        score: state.score,
        total: TOTAL_QUESTIONS,
        answers: state.answers,
        sentAt: new Date().toISOString(),
      };

      if (tg && tg.sendData) {
        tg.sendData(JSON.stringify(payload));
        tg.close();
        return;
      }

      window.alert(
        `Telegram WebApp API недоступен. Результат: ${state.score}/${TOTAL_QUESTIONS}. Запустите приложение из бота, чтобы отправка сработала.`,
      );
    }),
  );

  screenNode.appendChild(wrap);
}

initTelegram();
render();
