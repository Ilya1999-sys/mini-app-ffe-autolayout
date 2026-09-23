# Figa Trainer Quiz App

Статический Telegram Mini App: 7 вопросов по Auto Layout, два варианта ответа, экран объяснения после каждого вопроса и итоговый результат. Интерфейс собран из HTML/CSS и PNG-персонажей по [макету Figma](https://www.figma.com/design/KRhUglB3nBqRBtQ0YSTrLr/Gamification?node-id=3-172).

## Запуск локально

Из папки проекта:

```bash
python3 -m http.server 4173
```

Открыть `http://localhost:4173`.

## GitHub и Vercel

Репозиторий: [Ilya1999-sys/mini-app-ffe-autolayout](https://github.com/Ilya1999-sys/mini-app-ffe-autolayout). Он импортирован в Vercel: коммиты в `main` автоматически публикуются в production, другие ветки получают preview-деплои. Production URL: [mini-app-ffe-autolayout.vercel.app](https://mini-app-ffe-autolayout.vercel.app). Для статических HTML/CSS/JS отдельный шаг сборки не требуется.

## Подключение к Telegram-боту

В `@BotFather` → `/mybots` → Bot Settings → Menu Button выбрать `Web App` и указать `https://mini-app-ffe-autolayout.vercel.app`.

Для передачи полного результата через `Telegram.WebApp.sendData` бот должен открыть Mini App **клавиатурной** Web App-кнопкой с URL `https://mini-app-ffe-autolayout.vercel.app/?launch=keyboard` и обработать сообщение `web_app_data`. Mini App, открытый из кнопки меню, не может использовать этот механизм. В таком режиме финальная кнопка открывает `@FigmaForEditors_bot` со стартовым параметром `quiz_<баллы>`.

Стартовый параметр и JSON из клиента нельзя считать доказательством результата: пользователь может их изменить. Для выдачи реальных уникальных промокодов потребуется серверная проверка результата и учёт использованных кодов. Сейчас бот ещё не обрабатывает результат теста.

## Продукты для выбора в боте

- [Курс по Фигме для UX-редакторов](https://stepik.org/a/286605)
- [Базовый курс по Фигме](https://stepik.org/a/212750)
- [Курс для презентаций](https://stepik.org/a/233873)
- [Консультации](https://proeditor-figma.ru/konsultacii-po-dizajnu/)

Таблица соответствия баллов, продуктов и промокодов будет подключена после получения Google Sheets. Пользователь выбирает продукт в боте после теста.

## JSON при запуске через клавиатурную кнопку

```json
{
  "type": "quiz_completed",
  "score": 5,
  "total": 7,
  "offerOptions": [
    "Курс по Фигме для UX-редакторов",
    "Базовый курс по Фигме",
    "Курс для презентаций",
    "Консультации"
  ],
  "answers": [
    {
      "question": 1,
      "selected": 1,
      "correct": 1,
      "isCorrect": true
    }
  ],
  "requestedAt": "2026-09-22T00:00:00.000Z"
}
```
