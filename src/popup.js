document.addEventListener('DOMContentLoaded', async () => {
  const settings = await getSettings();
  document.getElementById('stt-provider').value = settings.sttProvider;
  document.getElementById('font-size').value = settings.fontSize;
  document.getElementById('font-size-val').textContent = settings.fontSize;
  document.getElementById('translate-enabled').checked = settings.translateEnabled;

  document.getElementById('font-size').addEventListener('input', async (e) => {
    document.getElementById('font-size-val').textContent = e.target.value;
    await setSetting('fontSize', parseInt(e.target.value));
  });

  document.getElementById('btn-generate').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.tabs.sendMessage(tab.id, { type: 'generateSubtitles', options: {} }, (res) => {
      if (chrome.runtime.lastError) {
        document.getElementById('video-info').textContent = 'Error: ' + chrome.runtime.lastError.message;
        return;
      }
      if (res && res.vtt) {
        document.getElementById('btn-download').disabled = false;
        document.getElementById('video-info').textContent = 'Subtitles generated!';
      }
    });
  });

  document.getElementById('btn-download').addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      chrome.tabs.sendMessage(tab.id, { type: 'downloadVTT' });
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
