const CORRECT_ANSWERS = [1, 2, 2, 1, 2, 2, 1];

function scoreAnswers(answers) {
  if (!Array.isArray(answers) || answers.length !== CORRECT_ANSWERS.length) {
    throw new Error("Нужны ответы на все семь вопросов");
  }

  const selected = Array(CORRECT_ANSWERS.length);
  for (const answer of answers) {
    if (!answer || !Number.isInteger(answer.question) || !Number.isInteger(answer.selected)) {
      throw new Error("Некорректный формат ответов");
    }
    const index = answer.question - 1;
    if (index < 0 || index >= CORRECT_ANSWERS.length || selected[index] || ![1, 2].includes(answer.selected)) {
      throw new Error("Некорректный набор ответов");
    }
    selected[index] = answer.selected;
  }

  if (selected.includes(undefined)) {
    throw new Error("Нужны ответы на все семь вопросов");
  }

  return selected.reduce((score, answer, index) => score + Number(answer === CORRECT_ANSWERS[index]), 0);
}

module.exports = { CORRECT_ANSWERS, scoreAnswers };
