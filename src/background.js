chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse).catch(sendResponse);
  return true;
});

async function handleMessage(message, sender) {
  switch (message.type) {
    case 'fetchWithAuth':
      return await fetch(message.url, { method: message.method, headers: message.headers, body: message.body });
    case 'getSettings':
      return await getSettings();
    case 'saveSettings':
      await saveSettings(message.settings);
      return { success: true };
    case 'generateSubtitles':
      return { subtitle: await generateSubtitles(message.videoUrl, message.options) };
    default:
      return { error: 'Unknown message type' };
  }
}

async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get({
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
    }, resolve);
  });
}

async function saveSettings(settings) {
  return new Promise((resolve) => {
    chrome.storage.sync.set(settings, resolve);
  });
}

async function generateSubtitles(options) {
  const settings = await getSettings();
  if (!settings.apiKey && settings.sttProvider === 'ai') {
    return { error: 'API key not configured' };
  }
  
  try {
    if (settings.sttProvider === 'ai') {
      const response = await fetchWithKey(settings.apiKey, settings.aiProvider, options);
      return response;
    } else {
      const response = await fallbackSTT(options);
      return response;
    }
  } catch (error) {
    return { error: error.message };
  }
}
