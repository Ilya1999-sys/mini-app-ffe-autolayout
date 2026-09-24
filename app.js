const OFFER_OPTIONS = [
  "Курс по Фигме для UX-редакторов",
  "Базовый курс по Фигме",
  "Курс для презентаций",
  "Консультации",
];

const BOT_USERNAME = "FigmaForEditors_bot";
const TOTAL_QUESTIONS = 7;

const questions = [
  {
    text: "Где изображён gap внутри автолейаута?",
    correctIndex: 0,
    explanation:
      "Gap управляет расстоянием между элементами внутри Auto Layout. В данном случае это отступ между заголовком и кнопкой.",
  },
  {
    text: "Где изображён gap внутри автолейаута?",
    correctIndex: 1,
    explanation:
      "В первом варианте показан интерлиньяж — межстрочное расстояние. А gap — это отступ между заголовком и описанием во втором варианте.",
  },
  {
    text: "В каком случае лучше использовать «hug» (или «fixed») для ширины заголовка",
    correctIndex: 1,
    explanation:
      "Во втором варианте ширину заголовка лучше оставить на hug/fixed, а описанию дать больше места.",
  },
  {
    text: "В каком случае лучше использовать «fill» для ширины текста",
    correctIndex: 0,
    explanation:
      "В первом варианте ширину заголовка и текста лучше задать fill, чтобы они занимали доступное пространство.",
  },
  {
    text: "Где изображён «padding» внутри карточки с автолейаутом?",
    correctIndex: 1,
    explanation:
      "Padding — внутренний отступ от края контейнера до контента. В первом варианте показан letter spacing.",
  },
  {
    text: "Где изображено горизонтальное выравнивание элементов с включённым переносом?",
    correctIndex: 1,
    explanation:
      "Во втором варианте включён перенос строк, поэтому теги 4 и 5 уехали ниже.",
  },
  {
    text: "В каком варианте сетки используется «hug» для ширины первой колонки?",
    correctIndex: 0,
    explanation:
      "В первом варианте включён hug для первой колонки, а вторая тянется на оставшуюся ширину.",
  },
];

const state = {
  screen: "welcome",
  questionIndex: 0,
  selectedOptionIndex: null,
  score: 0,
  answers: [],
  lastWasCorrect: false,
};

const root = document.getElementById("screen");

function fitDesktopScreen() {
  if (window.innerWidth <= 420) return;
  const availableHeight = window.innerHeight - 32;
  const availableWidth = window.innerWidth - 24;
  const scale = Math.min(1, availableHeight / 844, availableWidth / 390);
  document.documentElement.style.setProperty("--desktop-scale", String(Math.max(0, scale)));
}

window.addEventListener("resize", fitDesktopScreen);
fitDesktopScreen();

const getTg = () => (window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null);

function initTelegram() {
  const tg = getTg();
  if (!tg) return;
  tg.ready();
  tg.expand();
}

function makeTopBar(label) {
  return `<div class="topbar"><span>${label}</span></div>`;
}

function arrow() {
  return `<span class="arrow"></span>`;
}

function renderOptionVisual(questionIdx, optionIdx) {
  const key = `${questionIdx + 1}-${optionIdx + 1}`;
  switch (key) {
    case "1-1":
      return `
        <div class="demo-col">
          <p class="big-title center">Заголовок</p>
          ${arrow()}
          <div class="pill"><span>Кнопка</span></div>
        </div>
      `;
    case "1-2":
      return `
        <div class="demo-col">
          <p class="big-title center">Заголовок</p>
          <div class="pill"><span>Кнопка</span></div>
          ${arrow()}
        </div>
      `;
    case "2-1":
      return `
        <div class="demo-col">
          <p class="big-title center">Заголовок</p>
          <div class="description-stack">
            <p class="desc">Описание</p>
            ${arrow()}
            <p class="desc">в&nbsp;несколько строк</p>
            <p class="desc">Ещё одно описание<br>в&nbsp;несколько строк</p>
          </div>
        </div>
      `;
    case "2-2":
      return `
        <div class="demo-col">
          <p class="big-title center">Заголовок</p>
          ${arrow()}
          <p class="desc">Описание<br>в&nbsp;несколько строк</p>
          <p class="desc">Ещё одно описание<br>в&nbsp;несколько строк</p>
        </div>
      `;
    case "3-1":
      return `
        <div class="demo-col">
          <p class="big-title center">Заголовок</p>
          <p class="desc">Описание<br>в&nbsp;несколько строк,<br>а&nbsp;может быть<br>и&nbsp;ещё больше</p>
        </div>
      `;
    case "3-2":
      return `
        <div class="demo-row">
          <p class="mid-title">Заголовок</p>
          <p class="desc tight">Описание<br>в&nbsp;несколько строк,<br>а&nbsp;может быть<br>и&nbsp;ещё больше</p>
        </div>
      `;
    case "4-1":
      return `
        <div class="product">
          <div class="product-image"></div>
          <p class="mid-title wide">Название товара</p>
          <p class="desc">Описание товара, который хочется купить прямо здесь и сейчас</p>
        </div>
      `;
    case "4-2":
      return `
        <div class="product-row">
          <div class="product-thumb"></div>
          <p class="mid-title mini">Название товара</p>
          <p class="desc tight">Описание товара, который хочется купить прямо здесь и сейчас</p>
        </div>
      `;
    case "5-1":
      return `
        <div class="demo-col">
          <div class="split-title"><span>За</span>${arrow()}<span>головок</span></div>
          <div class="pill"><span>Кнопка</span></div>
        </div>
      `;
    case "5-2":
      return `
        <div class="demo-col">
          <p class="big-title center">Заголовок</p>
          <div class="pill"><span>Кнопка</span></div>
          ${arrow()}
        </div>
      `;
    case "6-1":
      return `
        <div class="tags two-cols">
          <span class="tag">тег-1</span><span class="tag">тег-2</span><span class="tag">тег-3</span><span class="tag">тег-4</span><span class="tag">тег-5</span>
        </div>
      `;
    case "6-2":
      return `
        <div class="tags wrap">
          <span class="tag small">тег-1</span><span class="tag small">тег-2</span><span class="tag small">тег-3</span><span class="tag small">тег-4</span><span class="tag small">тег-5</span>
        </div>
      `;
    case "7-1":
      return `
        <div class="grid-two">
          <span class="tag left">тег-1</span><span class="tag right">тег-2</span>
          <span class="tag left">тег-3</span><span class="tag right">тег-4</span>
          <span class="tag left">тег-5</span>
        </div>
      `;
    case "7-2":
      return `
        <div class="grid-two inverse">
          <span class="tag right">тег-1</span><span class="tag left">тег-2</span>
          <span class="tag right">тег-3</span><span class="tag left">тег-4</span>
          <span class="tag right">тег-5</span>
        </div>
      `;
    default:
      return "";
  }
}

function renderWelcome() {
  root.innerHTML = `
    <div class="layout">
      ${makeTopBar("Figma boy Trainer")}
      <img class="character welcome" src="./assets/characters/welcome@2x.png" alt="Figma boy" />
      <div class="welcome-copy">
        <h1>Figa хочет, чтобы вы&nbsp;изучили автолейаут быстро и&nbsp;легко</h1>
        <p>7 коротких задач по&nbsp;Auto Layout. За&nbsp;правильные ответы&nbsp;— промокод на&nbsp;скидку.</p>
      </div>
      <button class="cta enabled" id="startBtn">Начать игру</button>
    </div>
  `;
  document.getElementById("startBtn").onclick = () => {
    state.screen = "question";
    render();
  };
}

function renderQuestion() {
  const q = questions[state.questionIndex];
  root.innerHTML = `
    <div class="layout">
      ${makeTopBar(`Задание ${state.questionIndex + 1}/7`)}
      <div class="question-block">
        <h2>${q.text}</h2>
        <div class="answers" data-question="${state.questionIndex + 1}">
          <button class="quiz-card ${state.selectedOptionIndex === 0 ? "selected" : ""}" data-opt="0">${renderOptionVisual(
            state.questionIndex,
            0,
          )}</button>
          <button class="quiz-card ${state.selectedOptionIndex === 1 ? "selected" : ""}" data-opt="1">${renderOptionVisual(
            state.questionIndex,
            1,
          )}</button>
        </div>
      </div>
      <button class="cta ${state.selectedOptionIndex === null ? "disabled" : "enabled"}" id="answerBtn" ${
        state.selectedOptionIndex === null ? "disabled" : ""
      }>Проверить ответ</button>
    </div>
  `;

  root.querySelectorAll("[data-opt]").forEach((btn) => {
    btn.onclick = () => {
      state.selectedOptionIndex = Number(btn.dataset.opt);
      renderQuestion();
    };
  });

  document.getElementById("answerBtn").onclick = () => {
    if (state.selectedOptionIndex === null) return;
    const isCorrect = state.selectedOptionIndex === q.correctIndex;
    state.lastWasCorrect = isCorrect;
    if (isCorrect) state.score += 1;
    state.answers.push({
      question: state.questionIndex + 1,
      selected: state.selectedOptionIndex + 1,
      correct: q.correctIndex + 1,
      isCorrect,
    });
    state.screen = "result";
    render();
  };
}

function renderResult() {
  const q = questions[state.questionIndex];
  const isLast = state.questionIndex === TOTAL_QUESTIONS - 1;
  root.innerHTML = `
    <div class="layout result-layout">
      ${makeTopBar(`Задание ${state.questionIndex + 1}/7`)}
      <div class="result-copy">
        <h2 class="${state.lastWasCorrect ? "ok" : "lost"}">${state.lastWasCorrect ? "Верно" : "Не совсем правильно"}</h2>
        <p>${q.explanation}</p>
      </div>
      <img class="character ${state.lastWasCorrect ? "success" : "lost"}" src="./assets/characters/${
    state.lastWasCorrect ? "success" : "lost"
  }@2x.png" alt="Figma boy state" />
      <button class="cta enabled" id="nextBtn">${isLast ? "Смотреть результат" : "Следующее задание"}</button>
    </div>
  `;

  document.getElementById("nextBtn").onclick = () => {
    if (isLast) {
      state.screen = "final";
      render();
      return;
    }
    state.questionIndex += 1;
    state.selectedOptionIndex = null;
    state.screen = "question";
    render();
  };
}

function renderFinal() {
  root.innerHTML = `
    <div class="layout result-layout">
      ${makeTopBar("Завершение теста")}
      <div class="result-copy final-copy">
        <h2 class="score-text">${state.score} ${state.score === 1 ? "балл" : state.score >= 2 && state.score <= 4 ? "балла" : "баллов"}</h2>
        <p>Эти баллы вы можете использовать на получение скидки на наши курсы и консультации</p>
      </div>
      <img class="character final" src="./assets/characters/final@2x.png" alt="Figma boy finish" />
      <button class="cta enabled" id="benefitBtn">Получить выгоду</button>
    </div>
  `;

  document.getElementById("benefitBtn").onclick = async () => {
    const button = document.getElementById("benefitBtn");
    const payload = {
      type: "quiz_completed",
      score: state.score,
      total: TOTAL_QUESTIONS,
      answers: state.answers,
      offerOptions: OFFER_OPTIONS,
      requestedAt: new Date().toISOString(),
    };

    const tg = getTg();
    const launchedFromKeyboard = new URLSearchParams(window.location.search).get("launch") === "keyboard";
    if (launchedFromKeyboard && tg && tg.sendData) {
      tg.sendData(JSON.stringify(payload));
      return;
    }

    if (tg?.initData) {
      button.disabled = true;
      button.textContent = "Отправляем результат…";
      try {
        const response = await fetch("/api/quiz", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ initData: tg.initData, answers: state.answers }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Ошибка отправки результата");
        tg.close();
      } catch (error) {
        button.disabled = false;
        button.textContent = "Попробовать ещё раз";
        let status = document.getElementById("benefitStatus");
        if (!status) {
          status = document.createElement("p");
          status.id = "benefitStatus";
          status.className = "benefit-status";
          status.setAttribute("role", "status");
          button.before(status);
        }
        status.textContent = error.message;
      }
      return;
    }

    const botUrl = `https://t.me/${BOT_USERNAME}?start=quiz`;
    if (tg?.openTelegramLink) tg.openTelegramLink(botUrl);
    else window.location.href = botUrl;
  };
}

function render() {
  if (state.screen === "welcome") return renderWelcome();
  if (state.screen === "question") return renderQuestion();
  if (state.screen === "result") return renderResult();
  return renderFinal();
}

initTelegram();
render();
