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

    // Стилизация: зачеркивание, красный цвет
    span.style.textDecoration = "line-through";
    span.style.textDecorationColor = "red"; // Цвет линии
    span.style.color = "red";               // Цвет текста
    span.style.cursor = "help";             // Курсор вопросика при наведении

    // Добавляем всплывающую подсказку (нативный title)
    span.title = userText;

    // Оборачиваем выделенный текст в наш span
    // Примечание: surroundContents работает, если выделение находится внутри одного узла.
    // Если выделили половину одного абзаца и половину другого, может возникнуть ошибка.
    range.surroundContents(span);

    // Снимаем выделение, чтобы было видно результат
    selection.removeAllRanges();

  } catch (e) {
    console.error(e);
    alert("Пожалуйста, выделяйте текст в пределах одного блока (абзаца), чтобы применить стиль.");
  }
}