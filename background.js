// 缓存当前规则，避免每次请求都访问 storage
let rules = [];

// 从 storage 中加载规则
function loadRules() {
  chrome.storage.sync.get("headerRules", data => {
    rules = Array.isArray(data.headerRules) ? data.headerRules : [];
  });
}

// 初始化时加载一次
loadRules();

// 监听 storage 变更，保持 rules 最新
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "sync" && changes.headerRules) {
    rules = Array.isArray(changes.headerRules.newValue)
      ? changes.headerRules.newValue
      : [];
  }
});

// 拦截并修改请求头
chrome.webRequest.onBeforeSendHeaders.addListener(
  details => {
    if (!rules || rules.length === 0) {
      return;
    }

    const requestHeaders = details.requestHeaders || [];

    // 遍历所有启用的规则
    rules.forEach(rule => {
      if (!rule || !rule.enabled) return;

      const name = (rule.name || "").trim();
      const value = (rule.value || "").toString();

      if (!name) return;

      // 在现有请求头中查找（忽略大小写）
      const header = requestHeaders.find(
        h => h.name && h.name.toLowerCase() === name.toLowerCase()
      );

      if (header) {
        // 已存在则替换
        header.value = value;
      } else {
        // 不存在则新增
        requestHeaders.push({ name, value });
      }
    });

    return { requestHeaders };
  },
  { urls: ["<all_urls>"] },
  ["blocking", "requestHeaders", "extraHeaders"]
);
