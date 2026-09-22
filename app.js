const TOTAL_QUESTIONS = 7;

const questions = [
  {
    id: 1,
    progress: "Задание 1/7",
    text: "Где изображён gap внутри автолейаута?",
    options: [
      {
        title: "Вариант 1",
        note: "Отступ между заголовком и кнопкой показан стрелкой.",
      },
      {
        title: "Вариант 2",
        note: "Стрелка показывает другой тип отступа в карточке.",
      },
    ],
    correctIndex: 0,
    explanation:
      "Gap управляет расстоянием между элементами внутри Auto Layout. В данном случае это отступ между заголовком и кнопкой.",
  },
  {
    id: 2,
    progress: "Задание 2/7",
    text: "Где изображён gap внутри автолейаута?",
    options: [
      {
        title: "Вариант 1",
        note: "Показан интерлиньяж внутри текстового блока.",
      },
      {
        title: "Вариант 2",
        note: "Показан отступ между заголовком и описанием.",
      },
    ],
    correctIndex: 1,
    explanation:
      "В первом варианте показан интерлиньяж — межстрочное расстояние. А gap — это отступ между заголовком и описанием во втором варианте.",
  },
  {
    id: 3,
    progress: "Задание 3/7",
    text: "В каком случае лучше использовать hug (или fixed) для ширины заголовка?",
    options: [
      {
        title: "Вариант 1",
        note: "Широкий заголовок занимает большую часть карточки.",
      },
      {
        title: "Вариант 2",
        note: "Заголовок фиксирован/по контенту, а описанию оставлено больше места.",
      },
    ],
    correctIndex: 1,
    explanation:
      "Во втором варианте заголовок лучше держать на hug/fixed, а описанию дать больше пространства.",
  },
  {
    id: 4,
    progress: "Задание 4/7",
    text: "В каком случае лучше использовать fill для ширины текста?",
    options: [
      {
        title: "Вариант 1",
        note: "Заголовок и описание занимают доступную ширину блока.",
      },
      {
        title: "Вариант 2",
        note: "Описание зажато рядом с картинкой и заголовком.",
      },
    ],
    correctIndex: 0,
    explanation:
      "В первом варианте text лучше поставить на fill, чтобы он занимал свободное пространство и оставался читаемым.",
  },
  {
    id: 5,
    progress: "Задание 5/7",
    text: "Где изображён padding внутри карточки с автолейаутом?",
    options: [
      {
        title: "Вариант 1",
        note: "Показано межбуквенное расстояние в заголовке.",
      },
      {
        title: "Вариант 2",
        note: "Показан внутренний отступ контента от края карточки.",
      },
    ],
    correctIndex: 1,
    explanation:
      "Padding — это внутренний отступ от края контейнера до содержимого. В этом задании верный вариант — второй.",
  },
  {
    id: 6,
    progress: "Задание 6/7",
    text: "Где изображено горизонтальное выравнивание элементов с включённым переносом?",
    options: [
      {
        title: "Вариант 1",
        note: "Теги уложены в строгую двухколоночную сетку.",
      },
      {
        title: "Вариант 2",
        note: "Теги переносятся на следующую строку по мере нехватки места.",
      },
    ],
    correctIndex: 1,
    explanation:
      "Во втором варианте включён перенос строк, поэтому теги 4 и 5 уезжают ниже.",
  },
  {
    id: 7,
    progress: "Задание 7/7",
    text: "В каком варианте сетки используется hug для ширины первой колонки?",
    options: [
      {
        title: "Вариант 1",
        note: "Первая колонка hug, вторая тянется на оставшуюся ширину.",
      },
      {
        title: "Вариант 2",
        note: "Hug стоит у второй колонки, а первая растягивается.",
      },
    ],
    correctIndex: 0,
    explanation:
      "В первом варианте hug применён к первой колонке, а вторая заполняет остаток ширины.",
  },
];

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
  if (window.Telegram && window.Telegram.WebApp) {
    return window.Telegram.WebApp;
  }
  return null;
}

function initTelegram() {
  const tg = getTelegramApp();
  if (!tg) return;
  tg.ready();
  tg.expand();
}

function render() {
  if (state.screen === "welcome") renderWelcome();
  if (state.screen === "question") renderQuestion();
  if (state.screen === "result") renderResult();
  if (state.screen === "final") renderFinal();
}

function renderWelcome() {
  screenNode.innerHTML = `
    <div class="topbar">Figma boy Trainer</div>
    <div class="hero">Фигма-бой будет тут<br />после подбора референсов</div>
    <h1 class="title">Figa хочет, чтобы вы изучили автолейаут быстро и легко</h1>
    <p class="subtitle">7 коротких задач по Auto Layout. За правильные ответы — промокод на скидку.</p>
    <div class="spacer"></div>
    <button class="btn btn-primary" id="startBtn">Начать тест</button>
  `;
  document.getElementById("startBtn").addEventListener("click", () => {
    state.screen = "question";
    render();
  });
}

function renderQuestion() {
  const question = questions[state.questionIndex];
  const optionsHtml = question.options
    .map((option, idx) => {
      const selectedClass = state.selectedOptionIndex === idx ? "selected" : "";
      return `
        <button class="answer ${selectedClass}" data-option="${idx}">
          <span class="answer-label">${option.title}</span>
          <p class="answer-note">${option.note}</p>
        </button>
      `;
    })
    .join("");

  const disabled = state.selectedOptionIndex === null ? "disabled" : "";
  screenNode.innerHTML = `
    <div class="topbar">${question.progress}</div>
    <h2 class="question">${question.text}</h2>
    <div class="answers">${optionsHtml}</div>
    <div class="spacer"></div>
    <button class="btn btn-primary" id="answerBtn" ${disabled}>Ответ</button>
  `;

  document.querySelectorAll(".answer").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedOptionIndex = Number(button.dataset.option);
      renderQuestion();
    });
  });

  document.getElementById("answerBtn").addEventListener("click", () => {
    const isCorrect = state.selectedOptionIndex === question.correctIndex;
    state.lastWasCorrect = isCorrect;
    if (isCorrect) state.score += 1;
    state.answers.push({
      questionId: question.id,
      selected: state.selectedOptionIndex + 1,
      correct: question.correctIndex + 1,
      isCorrect,
    });
    state.screen = "result";
    render();
  });
}

function renderResult() {
  const question = questions[state.questionIndex];
  const title = state.lastWasCorrect ? "Верно" : "Не совсем правильно";
  const titleClass = state.lastWasCorrect ? "status-title" : "status-title error";
  const nextLabel =
    state.questionIndex === TOTAL_QUESTIONS - 1 ? "Смотреть результат" : "Следующее задание";

  screenNode.innerHTML = `
    <div class="topbar">${question.progress}</div>
    <h2 class="${titleClass}">${title}</h2>
    <p class="explanation">${question.explanation}</p>
    <div class="hero">Иллюстрация и Фигма-бой из макета</div>
    <div class="spacer"></div>
    <button class="btn btn-primary" id="nextBtn">${nextLabel}</button>
  `;

  document.getElementById("nextBtn").addEventListener("click", () => {
    if (state.questionIndex === TOTAL_QUESTIONS - 1) {
      state.screen = "final";
      render();
      return;
    }
    state.questionIndex += 1;
    state.selectedOptionIndex = null;
    state.screen = "question";
    render();
  });
}

function shareToTelegram(score) {
  const message = `Привет, Илья. Я прошёл тест и заработал в нём ${score} баллов.`;
  const encodedMessage = encodeURIComponent(message);
  const encodedUrl = encodeURIComponent("https://t.me/ilya_uxui_design");
  return `https://t.me/share/url?url=${encodedUrl}&text=${encodedMessage}`;
}

function renderFinal() {
  screenNode.innerHTML = `
    <div class="topbar">Завершение теста</div>
    <p class="score">${state.score} баллов</p>
    <p class="score-caption">Эти баллы вы можете использовать на получение скидки на ваши курсы и консультации.</p>
    <div class="hero">Финальный экран с Фигма-боем</div>
    <div class="spacer"></div>
    <button class="btn btn-primary" id="benefitBtn">Получить выгоду</button>
    <button class="btn btn-secondary" id="shareBtn">Отправить результат Илье</button>
  `;

  document.getElementById("benefitBtn").addEventListener("click", () => {
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
      `Сейчас бот не подключён. Результат: ${state.score}/${TOTAL_QUESTIONS}. Подключите mini-app к Telegram-боту, и данные будут уходить автоматически.`,
    );
  });

  document.getElementById("shareBtn").addEventListener("click", () => {
    window.open(shareToTelegram(state.score), "_blank", "noopener,noreferrer");
  });
}

initTelegram();
render();
