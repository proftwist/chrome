// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', restoreCorrections);
window.addEventListener('load', restoreCorrections);

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
  // Создаем временный элемент для поиска текста
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );

  let node;
  while (node = walker.nextNode()) {
    const nodeText = node.textContent;
    const textIndex = nodeText.indexOf(text);

    if (textIndex !== -1) {
      const parent = node.parentNode;
      if (parent && parent.nodeType === Node.ELEMENT_NODE) {
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