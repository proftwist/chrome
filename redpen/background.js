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