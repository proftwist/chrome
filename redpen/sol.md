Отличная идея для расширения. Это классическая задача на взаимодействие между **Background Script** (фон) и **Content Script** (скрипт, работающий на странице).

Мы будем использовать **Manifest V3** (современный стандарт для Chrome).

Вот полная структура проекта. Вам нужно создать папку (например, `red-paste-plugin`) и создать в ней 3 файла.

### 1. `manifest.json`
Этот файл говорит Хрому, что делает наше расширение и какие права ему нужны.

```json
{
  "manifest_version": 3,
  "name": "Красная паста",
  "version": "1.0",
  "description": "Зачеркивает текст и добавляет комментарий.",
  "permissions": [
    "contextMenus",
    "activeTab"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"]
    }
  ],
  "icons": {
    "16": "icon.png",
    "48": "icon.png",
    "128": "icon.png"
  }
}
```
*(Примечание: Вы можете создать любой файл `icon.png` или удалить блок `"icons"`, если иконки пока нет, расширение будет работать и без них).*

---

### 2. `background.js`
Этот скрипт работает в фоне. Он создает пункт меню и посылает команду на страницу, когда вы на него нажимаете.

```javascript
// Создаем пункт в контекстном меню при установке расширения
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "red-paste-action",
    title: "Красная паста",
    contexts: ["selection"] // Показываем только если выделен текст
  });
});

// Слушаем нажатие на пункт меню
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "red-paste-action") {
    // Отправляем сообщение в активную вкладку
    chrome.tabs.sendMessage(tab.id, { action: "markSelection" });
  }
});
```

---

### 3. `content.js`
Этот скрипт живет внутри веб-страницы. Он получает команду, меняет стили (CSS) и показывает окно ввода.

```javascript
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
```

---

### Как установить и протестировать

1.  Создайте папку на компьютере и сохраните туда 3 файла (`manifest.json`, `background.js`, `content.js`).
2.  Откройте Google Chrome.
3.  Перейдите по адресу `chrome://extensions/` (или Меню -> Расширения -> Управление расширениями).
4.  В правом верхнем углу включите **"Режим разработчика"** (Developer mode).
5.  Нажмите кнопку **"Загрузить распакованное расширение"** (Load unpacked).
6.  Выберите вашу папку.

### Как пользоваться

1.  Откройте любую веб-страницу (на `chrome://...` страницах расширения не работают, откройте обычный сайт, например, Википедию).
2.  **Выделите текст**.
3.  Нажмите **правую кнопку мыши**.
4.  Выберите пункт **"Красная паста"**.
5.  В появившемся окне введите текст (например: *"Здесь ошибка!"*) и нажмите ОК.
6.  Текст станет красным и зачеркнутым.
7.  Наведите мышку на этот текст — всплывет ваш комментарий.