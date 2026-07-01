const defaultSettings = {
  sttProvider: 'ai',
  aiProvider: 'openai',
  apiKey: '',
  sourceLang: 'en-US',
  targetLang: 'es-ES',
  autoGenerate: true,
  translateEnabled: true,
  fontSize: 18,
  textColor: '#ffffff',
  bgColor: '#000000',
  bgOpacity: 0.8,
};

document.addEventListener('DOMContentLoaded', loadSettings);

document.getElementById('save').addEventListener('click', saveSettings);
document.getElementById('test').addEventListener('click', testConnection);
document.getElementById('export').addEventListener('click', exportSettings);
document.getElementById('import').addEventListener('click', () => document.getElementById('import-file').click());
document.getElementById('import-file').addEventListener('change', importSettings);

function getEls() {
  return {
    sttProvider: document.getElementById('stt-provider'),
    aiProvider: document.getElementById('ai-provider'),
    apiKey: document.getElementById('api-key'),
    sourceLang: document.getElementById('source-lang'),
    targetLang: document.getElementById('target-lang'),
    autoGenerate: document.getElementById('auto-generate'),
    translateEnabled: document.getElementById('translate-enabled') || document.getElementById('translate-enabled'),
    fontSize: document.getElementById('font-size'),
    textColor: document.getElementById('text-color'),
    bgOpacity: document.getElementById('bg-opacity'),
  };
}

function loadSettings() {
  chrome.storage.sync.get(defaultSettings, (s) => {
    const e = getEls();
    e.sttProvider.value = s.sttProvider;
    e.aiProvider.value = s.aiProvider;
    e.apiKey.value = s.apiKey;
    e.sourceLang.value = s.sourceLang;
    e.targetLang.value = s.targetLang;
    e.autoGenerate.checked = s.autoGenerate;
    e.fontSize.value = s.fontSize;
    e.textColor.value = s.textColor;
    e.bgOpacity.value = s.bgOpacity;
    updateLabels();
  });
}

document.getElementById('font-size').addEventListener('input', updateLabels);
document.getElementById('bg-opacity').addEventListener('input', updateLabels);

function updateLabels() {
  const fs = document.getElementById('font-size');
  const bo = document.getElementById('bg-opacity');
  document.getElementById('font-size-val').textContent = fs.value;
  document.getElementById('bg-opacity-val').textContent = bo.value;
}

async function saveSettings() {
  const e = getEls();
  const settings = {
    sttProvider: e.sttProvider.value,
    aiProvider: e.aiProvider.value,
    apiKey: e.apiKey.value.trim(),
    sourceLang: e.sourceLang.value,
    targetLang: e.targetLang.value,
    autoGenerate: e.autoGenerate.checked,
    translateEnabled: document.getElementById('translate-enabled')?.checked ?? true,
    fontSize: parseInt(e.fontSize.value),
    textColor: e.textColor.value,
    bgColor: '#000000',
    bgOpacity: parseFloat(e.bgOpacity.value),
  };

  await new Promise((resolve) => chrome.storage.sync.set(settings, resolve));
  showMessage('Settings saved', 'success');
}

async function testConnection() {
  const apiKey = document.getElementById('api-key').value.trim();
  if (!apiKey) { showMessage('Enter an API key first', 'error'); return; }

  showMessage('Testing...', 'processing');
  try {
    const resp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: new FormData(),
    });
    if (resp.status === 401) throw new Error('Invalid API key');
    showMessage('Connection successful!', 'success');
  } catch (e) {
    showMessage('Connection failed: ' + e.message, 'error');
  }
}

function showMessage(text, type) {
  const el = document.getElementById('message');
  el.textContent = text;
  el.className = type;
  setTimeout(() => { el.textContent = ''; el.className = ''; }, 5000);
}

function exportSettings() {
  chrome.storage.sync.get(null, (settings) => {
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fb-subtitles-settings.json';
    a.click();
    URL.revokeObjectURL(url);
  });
}

function importSettings(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const settings = JSON.parse(reader.result);
      chrome.storage.sync.set(settings, () => {
        loadSettings();
        showMessage('Settings imported', 'success');
      });
    } catch (err) {
      showMessage('Invalid settings file', 'error');
    }
  };
  reader.readAsText(file);
}
