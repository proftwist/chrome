// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
  initializeRedPen();
});
window.addEventListener('load', () => {
  initializeRedPen();
});

// Инициализация расширения
function initializeRedPen() {
  setupURLChangeListener();
  setupMutationObserver();
  // Небольшая задержка для загрузки динамического контента
  setTimeout(restoreCorrections, 1000);
}

// Настройка отслеживания изменений URL (для SPA типа ВКонтакте)
function setupURLChangeListener() {
  // Отслеживаем изменения через History API
  const pushState = history.pushState;
  const replaceState = history.replaceState;

  history.pushState = function(...args) {
    pushState.apply(history, args);
    setTimeout(restoreCorrections, 500);
  };

  history.replaceState = function(...args) {
    replaceState.apply(history, args);
    setTimeout(restoreCorrections, 500);
  };

  // Слушаем событие изменения URL через popstate
  window.addEventListener('popstate', () => {
    setTimeout(restoreCorrections, 500);
  });
}

// Настройка наблюдателя за изменениями DOM
function setupMutationObserver() {
  const observer = new MutationObserver((mutations) => {
    let shouldRestore = false;

    mutations.forEach((mutation) => {
      // Проверяем, добавились ли новые текстовые узлы или элементы
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE) {
            shouldRestore = true;
          }
        });
      }
    });

    // Восстанавливаем правки с задержкой для загрузки всего контента
    if (shouldRestore) {
      setTimeout(restoreCorrections, 800);
    }
  });

  // Наблюдаем за всем документом
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "markSelection") {
    processSelection();
  }
});

function processSelection() {
  const selection = window.getSelection();

  // Если ничего не выделено или выделение пустое
  if (!selection.rangeCount || selection.isCollapsed) return;

  // Показываем окно ввода (стандартное браузерное)
  const userText = prompt("Введите комментарий для исправления:");

  // Если пользователь нажал "Отмена" или ничего не ввел — выходим
  if (userText === null) return;

  try {
    const range = selection.getRangeAt(0);

    // Создаем элемент, которым обернем текст
    const span = document.createElement("span");

    // Генерируем уникальный ID для правки
    const correctionId = generateId();

    // Стилизация: зачеркивание, красный цвет
    span.style.textDecoration = "line-through";
    span.style.textDecorationColor = "red"; // Цвет линии
    span.style.color = "red";               // Цвет текста
    span.style.cursor = "help";             // Курсор вопросика при наведении

    // Добавляем всплывающую подсказку (нативный title)
    span.title = userText;

    // Добавляем атрибут для идентификации правки
    span.setAttribute('data-redpen-id', correctionId);

    // Оборачиваем выделенный текст в наш span
    range.surroundContents(span);

    // Сохраняем правку в chrome.storage.local
    saveCorrection(correctionId, span.textContent, userText, window.location.href);

    // Снимаем выделение, чтобы было видно результат
    selection.removeAllRanges();

  } catch (e) {
    console.error(e);
    alert("Пожалуйста, выделяйте текст в пределах одного блока (абзаца), чтобы применить стиль.");
  }
}

function generateId() {
  return 'redpen_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function saveCorrection(id, text, comment, url) {
  // Сначала получаем все сохраненные правки
  chrome.storage.local.get(['redPenCorrections'], (result) => {
    const corrections = result.redPenCorrections || [];

    corrections.push({
      id: id,
      text: text,
      comment: comment,
      url: url,
      timestamp: Date.now()
    });

    // Сохраняем обновленный массив
    chrome.storage.local.set({ 'redPenCorrections': corrections }, () => {
      console.log('Правка сохранена:', text);
    });
  });
}

function getStoredCorrections() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['redPenCorrections'], (result) => {
      const corrections = result.redPenCorrections || [];
      resolve(corrections);
    });
  });
}

async function restoreCorrections() {
  console.log('Восстановление правок...');

  // Дополнительная задержка для ВКонтакте
  if (window.location.hostname.includes('vk.com')) {
    await new Promise(resolve => setTimeout(resolve, 1200));
  }

  const corrections = await getStoredCorrections();
  const currentUrl = window.location.href;

  // Фильтруем правки для текущей страницы
  const pageCorrections = corrections.filter(correction => correction.url === currentUrl);
  console.log(`Найдено ${pageCorrections.length} правок для этой страницы`);

  pageCorrections.forEach(correction => {
    try {
      console.log('Восстанавливаем правку:', correction.text);
      findAndMarkText(correction.text, correction.id, correction.comment);
    } catch (e) {
      console.error('Ошибка при восстановлении правки:', e);
    }
  });
}

function findAndMarkText(text, id, comment) {
  // Улучшенный поиск для ВКонтакте и других SPA
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        // Игнорируем пустые узлы и узлы в скриптах
        if (!node.textContent.trim() ||
            node.parentElement?.tagName === 'SCRIPT' ||
            node.parentElement?.tagName === 'STYLE') {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    },
    false
  );

  let node;
  while (node = walker.nextNode()) {
    const nodeText = node.textContent.trim();
    const textIndex = nodeText.indexOf(text.trim());

    if (textIndex !== -1) {
      const parent = node.parentNode;
      if (parent && parent.nodeType === Node.ELEMENT_NODE) {
        // Проверяем, не был ли текст уже обработан
        const existingMark = parent.querySelector(`[data-redpen-id="${id}"]`);
        if (existingMark) {
          continue; // Пропускаем, если уже обработано
        }

        // Создаем span для правки
        const span = document.createElement("span");
        span.style.textDecoration = "line-through";
        span.style.textDecorationColor = "red";
        span.style.color = "red";
        span.style.cursor = "help";
        span.title = comment;
        span.setAttribute('data-redpen-id', id);

        // Создаем текст до выделенного фрагмента
        if (textIndex > 0) {
          parent.insertBefore(document.createTextNode(nodeText.substring(0, textIndex)), node);
        }

        // Добавляем span с выделенным текстом
        span.textContent = text;
        parent.insertBefore(span, node);

        // Добавляем оставшийся текст
        if (textIndex + text.length < nodeText.length) {
          parent.insertBefore(document.createTextNode(nodeText.substring(textIndex + text.length)), node);
        }

        // Удаляем оригинальный узел
        parent.removeChild(node);
        break;
      }
    }
  }
}