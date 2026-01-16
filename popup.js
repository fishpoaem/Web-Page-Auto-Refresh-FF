let currentTabId = null;

document.addEventListener('DOMContentLoaded', async () => {
  const intervalInput = document.getElementById('interval');
  const startBtn = document.getElementById('start');
  const stopBtn = document.getElementById('stop');
  const statusDiv = document.getElementById('status');
  const nextRefreshDiv = document.getElementById('nextRefresh');

  // 获取当前标签
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  currentTabId = tab.id;

  // 加载设置
  const keys = [
    'refreshInterval',
    'reloadWithoutRefresh',
    'refreshAllTabs',
    'randomInterval',
    'clearCache',
    'showNotification',
    'notifyOnAnyChange'
  ];
  const settings = await browser.storage.local.get(keys);

  if (settings.refreshInterval !== undefined) {
    intervalInput.value = settings.refreshInterval;
  }
  document.getElementById('reloadWithoutRefresh').checked = !!settings.reloadWithoutRefresh;
  document.getElementById('refreshAllTabs').checked = !!settings.refreshAllTabs;
  document.getElementById('randomInterval').checked = !!settings.randomInterval;
  document.getElementById('clearCache').checked = !!settings.clearCache;
  document.getElementById('showNotification').checked = !!settings.showNotification;
  document.getElementById('notifyOnAnyChange').checked = !!settings.notifyOnAnyChange;

  // 快捷按钮
  document.querySelectorAll('.quick-buttons button').forEach(btn => {
    btn.addEventListener('click', () => {
      intervalInput.value = btn.dataset.interval;
    });
  });

  // 启动
  startBtn.addEventListener('click', async () => {
    const seconds = parseFloat(intervalInput.value);
    if (isNaN(seconds) || seconds < 0.1 || seconds > 3600) {
      alert('请输入 0.1 到 3600 之间的有效数值');
      return;
    }

    const options = {
      refreshInterval: seconds,
      reloadWithoutRefresh: document.getElementById('reloadWithoutRefresh').checked,
      refreshAllTabs: document.getElementById('refreshAllTabs').checked,
      randomInterval: document.getElementById('randomInterval').checked,
      clearCache: document.getElementById('clearCache').checked,
      showNotification: document.getElementById('showNotification').checked,
      notifyOnAnyChange: document.getElementById('notifyOnAnyChange').checked
    };

    await browser.storage.local.set(options);
    await browser.runtime.sendMessage({
      action: 'start',
      tabId: currentTabId,
      interval: seconds * 1000,
      options
    });

    updateUI();
  });

  // 停止
  stopBtn.addEventListener('click', async () => {
    await browser.runtime.sendMessage({
      action: 'stop',
      tabId: currentTabId
    });
    updateUI();
  });

  // 更新 UI
  let countdownTimer = null;
  async function updateUI() {
    if (countdownTimer) clearInterval(countdownTimer);

    const response = await browser.runtime.sendMessage({
      action: 'getStatus',
      tabId: currentTabId
    });

    if (response?.active) {
      const intervalSec = (response.interval / 1000).toFixed(1);
      statusDiv.textContent = `正在刷新 (${intervalSec}s)`;

      const now = Date.now();
      const remaining = Math.max(0, response.nextRefreshTime - now);
      const sec = (remaining / 1000).toFixed(1);
      nextRefreshDiv.textContent = `下次刷新：${sec} 秒`;
      nextRefreshDiv.style.display = 'inline';
    } else {
      statusDiv.textContent = '未启动';
      nextRefreshDiv.textContent = '';
      nextRefreshDiv.style.display = 'none';
    }

    // 实时倒计时
    if (response?.active) {
      countdownTimer = setInterval(() => {
        const now = Date.now();
        const remaining = Math.max(0, response.nextRefreshTime - now);
        const sec = (remaining / 1000).toFixed(1);
        if (remaining <= 0) {
          clearInterval(countdownTimer);
          countdownTimer = null;
          updateUI();
        } else {
          nextRefreshDiv.textContent = `下次刷新：${sec} 秒`;
        }
      }, 100);
    }
  }

  updateUI();
});