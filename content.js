// content.js
(() => {
  try {
    const token = localStorage.getItem("access_token");
    if (token) {
      chrome.runtime.sendMessage({ type: "SAVE_TOKEN", token });
      console.debug("[keka-ext] sent token to background");
    } else {
      console.debug("[keka-ext] access_token not found in localStorage");
    }
  } catch (err) {
    console.error("[keka-ext] content script error:", err);
  }
})();
