const refreshStates = new Map();

browser.tabs.onRemoved.addListener((tabId) => {
  stopRefresh(tabId);
});

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { action, tabId, interval, options } = message;
  if (action === 'start' && tabId !== undefined && interval !== undefined) {
    startRefresh(tabId, interval, options);
    sendResponse({ success: true });
  } else if (action === 'stop' && tabId !== undefined) {
    stopRefresh(tabId);
    sendResponse({ success: true });
  } else if (action === 'getStatus' && tabId !== undefined) {
    const state = refreshStates.get(tabId);
    sendResponse({
      active: !!state,
      interval: state ? state.interval : null,
      nextRefreshTime: state ? state.nextRefreshTime : null
    });
  }
  return true;
});

function startRefresh(tabId, intervalMs, options) {
  stopRefresh(tabId);

  const scheduleNext = () => {
    let nextInterval = intervalMs;
    if (options?.randomInterval) {
      const min = 5 * 1000;
      const max = 10 * 1000;
      nextInterval = Math.floor(Math.random() * (max - min + 1)) + min;
    }

    const nextTime = Date.now() + nextInterval;
    const timerId = setTimeout(() => {
      const currentState = refreshStates.get(tabId);
      if (!currentState) return;

      if (options?.refreshAllTabs) {
        browser.tabs.query({ currentWindow: true }).then(tabs => {
          tabs.forEach(tab => {
            if (tab.id) browser.tabs.reload(tab.id, { bypassCache: options.clearCache });
          });
        });
      } else {
        browser.tabs.reload(tabId, { bypassCache: options.clearCache });
      }

      if (options?.showNotification) {
        browser.notifications.create({
          type: 'basic',
          title: 'Auto Refresh',
          message: '页面已刷新',
          iconUrl: 'icons/icon48.png'
        });
      }
      if (options?.notifyOnAnyChange) {
        browser.notifications.create({
          type: 'basic',
          title: 'Auto Refresh',
          message: '设置已更新',
          iconUrl: 'icons/icon48.png'
        });
      }

      scheduleNext();
    }, nextInterval);

    refreshStates.set(tabId, {
      interval: nextInterval,
      nextRefreshTime: nextTime,
      options: { ...options },
      timerId: timerId
    });
  };

  scheduleNext();
}

function stopRefresh(tabId) {
  const state = refreshStates.get(tabId);
  if (state) {
    clearTimeout(state.timerId);
    refreshStates.delete(tabId);
  }
}