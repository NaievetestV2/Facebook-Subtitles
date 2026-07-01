document.addEventListener('DOMContentLoaded', async () => {
  const settings = await getSettings();
  document.getElementById('stt-provider').value = settings.sttProvider;
  document.getElementById('font-size').value = settings.fontSize;
  document.getElementById('font-size-val').textContent = settings.fontSize;
  document.getElementById('translate-enabled').checked = settings.translateEnabled;

  const updateVideoInfo = async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) {
        document.getElementById('video-info').textContent = 'No active tab';
        return;
      }
      const res = await chrome.tabs.sendMessage(tab.id, { type: 'getVideoCount' });
      document.getElementById('video-info').textContent = (res && res.count)
        ? `${res.count} video(s) detected`
        : 'No video detected';
    } catch (e) {
      document.getElementById('video-info').textContent = 'No video detected';
    }
  };

  updateVideoInfo();

  document.getElementById('font-size').addEventListener('input', async (e) => {
    document.getElementById('font-size-val').textContent = e.target.value;
    await setSetting('fontSize', parseInt(e.target.value));
  });

  document.getElementById('btn-generate').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      document.getElementById('video-info').textContent = 'Open a Facebook tab first';
      return;
    }
    chrome.tabs.sendMessage(tab.id, { type: 'generateSubtitles', options: {} }, (res) => {
      if (chrome.runtime.lastError) {
        document.getElementById('video-info').textContent = 'Error: ' + chrome.runtime.lastError.message;
        return;
      }
      if (res && res.error) {
        document.getElementById('video-info').textContent = res.error;
        return;
      }
      if (res && res.ok) {
        document.getElementById('video-info').textContent = 'Subtitles generated!';
        document.getElementById('btn-download').disabled = false;
      }
    });
  });

  document.getElementById('btn-download').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;
    chrome.tabs.sendMessage(tab.id, { type: 'downloadVTT' }, (res) => {
      if (chrome.runtime.lastError) {
        document.getElementById('video-info').textContent = 'Error: ' + chrome.runtime.lastError.message;
      }
    });
  });
});

async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get({
      sttProvider: 'ai', aiProvider: 'openai', apiKey: '',
      sourceLang: 'en-US', targetLang: 'es-ES',
      autoGenerate: true, translateEnabled: true,
      fontSize: 18, textColor: '#ffffff', bgColor: '#000000', bgOpacity: 0.8
    }, resolve);
  });
}

async function setSetting(key, value) {
  await new Promise((resolve) => chrome.storage.sync.set({ [key]: value }, resolve));
}
