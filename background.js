const MENU_ID = "linkvault-fill";

function registerContextMenu() {
  chrome.contextMenus.removeAll(() => {
    if (chrome.runtime.lastError) return;
    chrome.contextMenus.create({
      id: MENU_ID,
      title: "Show LinkVault suggestions",
      contexts: ["editable"]
    });
  });
}

chrome.runtime.onInstalled.addListener(registerContextMenu);
chrome.runtime.onStartup.addListener(registerContextMenu);

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID || !tab?.id) return;
  chrome.tabs.sendMessage(tab.id, { type: "LINKVAULT_SHOW_PICKER" }).catch(() => {});
});