(function() {
  'use strict';

  const state = {
    videos: new Map(),
    subtitles: new Map(),
    settings: {},
    processing: false,
  };

  const selectors = {
    video: 'video, [data-video-id], [role="feed"] video, ._5r51 video, video[playsinline]',
    reel: '[data-visualcompletion="media-vc-image"] video, .x1lliihq video, video[data-visualcompletion]',
    story: '[role="feed"] video',
  };

  function init() {
    loadSettings();
    observeDOM();
    processVideos();
    injectStyles();
  }

  function loadSettings() {
    if (typeof chrome !== 'undefined' && chrome.storage) {
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
      }, (s) => { state.settings = s; });
    }
  }

  function observeDOM() {
    const observer = new MutationObserver(() => processVideos());
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'poster'] });
  }

  function processVideos() {
    const videos = document.querySelectorAll(selectors.video);
    videos.forEach(video => {
      if (state.videos.has(video)) return;
      if (!video.src || video.src === window.location.href) return;
      
      state.videos.set(video, true);
      attachSubtitles(video);
    });
  }

  function attachSubtitles(video) {
    video.removeAttribute('crossorigin');
    const container = ensureSubtitleContainer(video);
    
    if (state.settings.autoGenerate) {
      video.addEventListener('play', () => {
        if (!state.subtitles.has(video)) generateSubtitlesForVideo(video, container);
      }, { once: false });
    }
  }

  function ensureSubtitleContainer(video) {
    let container = video.parentElement.querySelector('.fb-subtitle-overlay');
    if (!container) {
      container = document.createElement('div');
      container.className = 'fb-subtitle-overlay';
      styleOverlay(container);
      video.parentElement.style.position = 'relative';
      video.parentElement.appendChild(container);
    }
    return container;
  }

  function styleOverlay(container) {
    const s = state.settings;
    Object.assign(container.style, {
      position: 'absolute',
      left: '5%',
      right: '5%',
      bottom: s.fontSize > 24 ? '15%' : '10%',
      textAlign: 'center',
      pointerEvents: 'none',
      zIndex: '99999',
      fontFamily: 'Arial, sans-serif',
    });
  }

  async function generateSubtitlesForVideo(video, container) {
    if (state.processing) return;
    state.processing = true;
    
    postStatus(container, 'Generating subtitles...');
    
    try {
      const audioBlob = await captureAudio(video);
      const cues = await requestTranscription(audioBlob, video);
      
      if (cues) {
        state.subtitles.set(video, cues);
        syncSubtitles(video, container, cues);
      }
    } catch (error) {
      postStatus(container, 'Subtitle generation failed');
      console.error('[FB-Subtitles]', error);
    } finally {
      state.processing = false;
    }
  }

  async function captureAudio(video) {
    return new Promise((resolve, reject) => {
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioCtx.createMediaElementSource(video);
        const dest = audioCtx.createMediaStreamDestination();
        source.connect(dest);
        source.connect(audioCtx.destination);
        
        const chunks = [];
        const recorder = new MediaRecorder(dest.stream, { mimeType: 'audio/webm;codecs=opus' });
        
        recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'audio/webm' });
          source.disconnect();
          audioCtx.close();
          resolve(blob);
        };
        
        recorder.start();
        video.addEventListener('timeupdate', check, { once: true });
        
        function check() {
          if (video.paused || video.ended) recorder.stop();
          else setTimeout(() => video.dispatchEvent(new Event('check')), 1000);
        }
        
        video.addEventListener('ended', () => { if (recorder.state === 'recording') recorder.stop(); }, { once: true });
      } catch (e) {
        reject(new Error('Audio capture failed: ensure browser allows microphone/audio capture'));
      }
    });
  }

  async function requestTranscription(audioBlob, video) {
    const s = state.settings;
    
    if (s.sttProvider === 'ai' && s.apiKey) {
      return await transcribeAI(audioBlob, s);
    } else if (s.sttProvider === 'browser') {
      return await transcribeBrowser(video);
    } else if (s.sttProvider === 'deepgram') {
      return await transcribeDeepgram(audioBlob, s);
    } else if (s.sttProvider === 'assemblyai') {
      return await transcribeAssemblyAI(audioBlob, s);
    } else {
      return await transcribeBrowser(video);
    }
  }

  async function transcribeAI(audioBlob, settings) {
    const { apiKey, aiProvider } = settings;
    
    let url, headers, body;
    const form = new FormData();
    form.append('file', audioBlob, 'audio.webm');
    form.append('model', 'whisper-1');
    form.append('response_format', 'vtt');
    form.append('language', 'en');
    
    if (aiProvider === 'openai') {
      url = 'https://api.openai.com/v1/audio/transcriptions';
      headers = { 'Authorization': `Bearer ${apiKey}` };
      body = form;
    } else if (aiProvider === 'deepgram') {
      url = 'https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&language=en';
      body = audioBlob;
      headers = { 'Authorization': `Token ${apiKey}`, 'Content-Type': 'audio/webm' };
    } else if (aiProvider === 'groq') {
      url = 'https://api.groq.com/openai/v1/audio/transcriptions';
      headers = { 'Authorization': `Bearer ${apiKey}` };
      body = form;
    } else {
      throw new Error('Unsupported AI provider');
    }
    
    const resp = await fetch(url, { method: 'POST', headers, body });
    if (!resp.ok) {
      const t = await resp.text();
      throw new Error(`AI transcription failed (${resp.status}): ${t}`);
    }
    
    const vtt = await resp.text();
    return parseVTT(vtt);
  }

  async function transcribeBrowser(video) {
    if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      throw new Error('Browser Speech API not supported');
    }
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = state.settings.sourceLang || 'en-US';
    
    return new Promise((resolve, reject) => {
      const results = [];
      recognition.onresult = (event) => {
        const result = event.results[event.results.length - 1];
        results.push(result[0].transcript);
      };
      
      recognition.onerror = (e) => reject(new Error(`Speech API: ${e.error}`));
      recognition.onend = () => resolve([{ start: 0, end: video.duration, text: results.join(' ') }]);
      
      recognition.start();
      video.play().catch(() => {});
      
      video.addEventListener('ended', () => {
        recognition.stop();
        resolve([{ start: 0, end: video.duration, text: results.join(' ') }]);
      }, { once: true });
    });
  }

  async function transcribeDeepgram(audioBlob, settings) {
    const url = 'https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true';
    const body = await audioBlob.arrayBuffer();
    
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${settings.apiKey}`,
        'Content-Type': 'audio/webm',
      },
      body,
    });
    
    if (!resp.ok) throw new Error(`Deepgram error: ${resp.statusText}`);
    const result = await resp.json();
    return parseDeepgramResult(result);
  }

  function parseDeepgramResult(data) {
    if (!data.results || !data.results.channels || !data.results.channels[0].alternatives) return [];
    const alt = data.results.channels[0].alternatives[0];
    if (!alt.words) return [];
    return [{ start: 0, end: alt.words[alt.words.length - 1].end, text: alt.transcript }];
  }

  async function transcribeAssemblyAI(audioBlob, settings) {
    const uploadResp = await fetch('https://api.assemblyai.com/v2/upload', {
      method: 'POST',
      headers: { 'Authorization': settings.apiKey },
      body: audioBlob,
    });
    const uploadData = await uploadResp.json();
    const transcriptResp = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: { 'Authorization': settings.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ audio_url: uploadData.upload_url, language_code: 'en' }),
    });
    const transcriptData = await transcriptResp.json();
    
    let result = transcriptData;
    while (result.status !== 'completed' && result.status !== 'error') {
      await new Promise(r => setTimeout(r, 3000));
      const statusResp = await fetch(`https://api.assemblyai.com/v2/transcript/${result.id}`, {
        headers: { 'Authorization': settings.apiKey },
      });
      result = await statusResp.json();
    }
    
    if (result.status === 'error') throw new Error(result.error);
    return parseVTT(result.vtt);
  }

  function parseVTT(vttText) {
    const cues = [];
    const lines = vttText.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(/(\d{2}):(\d{2}):(\d{2}\.\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}\.\d{3})/);
      if (match) {
        const start = parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseFloat(match[3]);
        const end = parseInt(match[4]) * 3600 + parseInt(match[5]) * 60 + parseFloat(match[6]);
        let text = '';
        i++;
        while (i < lines.length && lines[i].trim().length > 0) {
          text += (text ? ' ' : '') + lines[i].replace(/<[^>]+>/g, '').trim();
          i++;
        }
        if (text) cues.push({ start, end, text });
      }
    }
    return cues;
  }

  function syncSubtitles(video, container, cues) {
    container.innerHTML = '';
    let current = null;
    
    const update = () => {
      if (!cues.length) return;
      const t = video.currentTime;
      const cue = cues.find(c => t >= c.start && t <= c.end);
      
      if (!cue) {
        if (current) { current.remove(); current = null; }
        return;
      }
      
      if (current && current.textContent === cue.text) return;
      
      if (current) current.remove();
      const el = document.createElement('div');
      el.className = 'subtitle-line';
      el.textContent = cue.text;
      container.appendChild(el);
      current = el;
    };
    
    video.addEventListener('timeupdate', update);
    video.addEventListener('seeked', update);
    video.addEventListener('pause', () => {
      if (current) current.remove();
    });
  }

  function postStatus(container, msg) {
    if (!container) return;
    container.innerHTML = `<div class="subtitle-status">${msg}</div>`;
  }

  function injectStyles() {
    if (document.getElementById('fb-subtitles-styles')) return;
    const link = document.createElement('link');
    link.id = 'fb-subtitles-styles';
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('src/content.css');
    document.head.appendChild(link);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
