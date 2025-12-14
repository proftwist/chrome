const statuses = {
  "read": { title: "Прочитать", emoji: "📖" },
  "reply": { title: "Ответить", emoji: "↩️" },
  "research": { title: "Исследовать", emoji: "🔍" },
  "todo": { title: "Сделать / Срочно", emoji: "🔥" },
  "reference": { title: "Справка", emoji: "ℹ️" },
  "clear": { title: "Очистить статус", emoji: "" }
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "status-parent",
    title: "Статус",
    contexts: ["page", "selection", "link"]
  });

  for (const [key, value] of Object.entries(statuses)) {
    chrome.contextMenus.create({
      id: key,
      parentId: "status-parent",
      title: value.emoji ? `${value.emoji} ${value.title}` : value.title,
      contexts: ["page", "selection", "link"]
    });
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (statuses[info.menuItemId]) {
    const selectedEmoji = statuses[info.menuItemId].emoji;
    // Список всех эмодзи для регулярного выражения
    const allEmojis = Object.values(statuses).map(s => s.emoji).filter(e => e !== "");

    if (tab && tab.id) {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: setTabStatus,
        args: [selectedEmoji, allEmojis]
      });
    }
  }
});

function setTabStatus(targetEmoji, allEmojisList) {
  const currentTitle = document.title;

  // --- 1. ПРОВЕРКА НА ПОВТОР (TOGGLE) ---
  // Проверяем, стоит ли ИМЕННО ЭТОТ эмодзи сейчас первым.
  // Если да, мы будем его снимать (reset).
  // Используем indexOf(0), это надежнее startsWith для эмодзи
  let isToggleAction = false;
  if (targetEmoji && currentTitle.indexOf(targetEmoji) === 0) {
      isToggleAction = true;
  }

  // --- 2. ЖЕСТКАЯ ОЧИСТКА ЗАГОЛОВКА ---
  // Создаем регулярное выражение из всех наших эмодзи.
  // Оно ищет любой из эмодзи в начале строки (^), за которым следует любое кол-во пробелов (\s*)
  // Флаг "u" нужен для корректной работы с юникодом (эмодзи)
  const regexPattern = new RegExp(`^(${allEmojisList.join('|')})\\s*`, 'u');

  let cleanTitle = currentTitle;
  // Цикл "пока находится мусор в начале — удаляй".
  // Это уберет и "🔥 Заголовок", и "🔥 🔥 Заголовок", и "📖 🔥 Заголовок".
  while (regexPattern.test(cleanTitle)) {
      cleanTitle = cleanTitle.replace(regexPattern, "").trim();
  }

  // --- 3. УСТАНОВКА НОВОГО ЗАГОЛОВКА ---
  if (isToggleAction || !targetEmoji) {
      // Если это "Тоггл" (сброс) или кнопка "Очистить"
      document.title = cleanTitle;
      targetEmoji = ""; // Сбрасываем переменную, чтобы фавиконка тоже поняла, что надо очиститься
  } else {
      // Иначе ставим новый статус
      document.title = `${targetEmoji} ${cleanTitle}`;
  }

  // --- 4. РАБОТА С ФАВИКОНКОЙ ---
  const updateFavicon = () => {
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
    }

    // Сохраняем оригинал.
    // Важно: проверяем, не является ли текущая иконка уже нашей (data:image...)
    // Если она data:image, значит оригинал уже должен быть сохранен в dataset ранее.
    const isOurGeneratedIcon = link.href.startsWith("data:image");

    if (!document.head.dataset.originalFavicon && !isOurGeneratedIcon) {
        document.head.dataset.originalFavicon = link.href;
    }

    // Если мы сбросили статус (targetEmoji пуст) -> ВОЗВРАЩАЕМ ОРИГИНАЛ
    if (!targetEmoji) {
        if (document.head.dataset.originalFavicon) {
            link.href = document.head.dataset.originalFavicon;
            // Удаляем атрибут type, чтобы браузер перечитал формат (важно для переключения svg/png/ico)
            link.removeAttribute("type");
        }
        return;
    }

    // Если ставим статус -> РИСУЕМ ЭМОДЗИ
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");

    ctx.font = "54px serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(targetEmoji, 32, 36);

    link.type = "image/x-icon";
    link.href = canvas.toDataURL();
  };

  updateFavicon();
}