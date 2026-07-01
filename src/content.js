(function() {
  'use strict';

const DEBUG = true;
const log = (...args) => { if (DEBUG) console.log('[FB-Subtitles]', ...args); };

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ping') return sendResponse({ ok: true });
  if (message.type === 'getVideoCount') return sendResponse({ count: getLastVideoCount() });
  if (message.type === 'generateSubtitlesNow' || message.type === 'generateSubtitles') {
    const videos = getAllVideos();
    const video = videos[0];
    if (video) {
      const container = ensureSubtitleContainer();
      generateSubtitlesForVideo(video, container).then(() => sendResponse({ ok: true })).catch(sendResponse);
    } else {
      sendResponse({ error: 'no video' });
    }
    return true;
  }
});
const state = {
  videos: new Map(),
  subtitles: new Map(),
  settings: {},
  processing: new Map(),
  lastVideoCount: 0,
};

const selectors = {
  video: 'video',
  reel: '[data-visualcompletion="media-vc-image"] video',
  story: '[role="feed"] video',
  all: 'video, [data-visualcompletion="media-vc-image"] video, [role="feed"] video, [data-video-id] video, video[playsinline]',
};

  function init() {
    loadSettings();
    observeDOM();
    processVideos();
    injectStyles();
    setTimeout(processVideos, 1500);
    setTimeout(processVideos, 4000);
    setInterval(() => {
      if (!state.processing.size) processVideos();
    }, 8000);
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
    let rafId = null;
    const observer = new MutationObserver(() => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        processVideos();
        rafId = null;
      });
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  function processVideos() {
    const allVideos = getAllVideos();
    state.lastVideoCount = allVideos.length;
    console.log('[FB-Subtitles] processVideos found', allVideos.length, 'candidate videos');
    allVideos.forEach(video => {
      if (state.videos.has(video)) return;
      if (video.src === window.location.href) return;
      if (!video.src && !video.srcObject && video.readyState < 2 && video.paused) return;
      state.videos.set(video, true);
      console.log('[FB-Subtitles] attaching to video', video.src || 'srcObject');
      attachSubtitles(video);
    });
  }

  function getLastVideoCount() {
    return state.lastVideoCount;
  }

  function getAllVideos() {
    const results = new Set();
    const selectors = [
      'video',
      '[data-visualcompletion="media-vc-image"] video',
      '[role="feed"] video',
      '[data-video-id] video',
      'video[playsinline]',
      'div[data-video-id] video',
      'div[data-video-url] video',
      'div[data-video-source] video'
    ];
    for (const sel of selectors) {
      try {
        document.querySelectorAll(sel).forEach(v => results.add(v));
      } catch (e) {}
    }
    return Array.from(results);
  }

  function attachSubtitles(video) {
    video.removeAttribute('crossorigin');
    const container = ensureSubtitleContainer(video);
    console.log('[FB-Subtitles] attached listeners to video');
    
    if (state.settings.autoGenerate) {
      video.addEventListener('play', () => {
        console.log('[FB-Subtitles] play event fired');
        if (!state.subtitles.has(video)) generateSubtitlesForVideo(video, container);
      }, { once: false });
      
      if (!video.paused && video.readyState >= 2 && !state.processing.has(video)) {
        console.log('[FB-Subtitles] already playing, auto-starting');
        generateSubtitlesForVideo(video, container);
      }
    }
  }

  function ensureSubtitleContainer(video) {
    let container = document.querySelector('.fb-subtitle-overlay');
    if (!container) {
      container = document.createElement('div');
      container.className = 'fb-subtitle-overlay';
      document.body.appendChild(container);
    }
    return container;
  }

  function syncOverlayPosition(video, container) {
    if (!video || !container) return;
    try {
      const rect = video.getBoundingClientRect();
      container.style.position = 'fixed';
      container.style.left = rect.left + 'px';
      container.style.top = (rect.bottom - 48) + 'px';
      container.style.width = rect.width + 'px';
      container.style.zIndex = '2147483647';
    } catch (e) {}
  }

  async function generateSubtitlesForVideo(video, container) {
    if (state.processing.has(video)) return;
    state.processing.set(video, true);
    
    postStatus(container, 'Generating subtitles...');
    
    try {
      const audioBlob = await captureAudio(video);
      const cues = await requestTranscription(audioBlob, video);
      
      if (cues) {
        state.subtitles.set(video, cues);
        syncSubtitles(video, container, cues);
      } else {
        postStatus(container, 'No speech detected');
      }
    } catch (error) {
      postStatus(container, 'Subtitle generation failed');
      console.error('[FB-Subtitles]', error);
      state.subtitles.delete(video);
    } finally {
      state.processing.delete(video);
    }
  }

  async function captureAudio(video) {
    return new Promise((resolve, reject) => {
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        let source;
        try {
          source = audioCtx.createMediaElementSource(video);
        } catch (e) {
          source = null;
        }
        
        let stream;
        if (source) {
          const dest = audioCtx.createMediaStreamDestination();
          source.connect(dest);
          source.connect(audioCtx.destination);
          stream = dest.stream;
        } else if (video.captureStream) {
          stream = video.captureStream();
        } else if (video.mozCaptureStream) {
          stream = video.mozCaptureStream();
        } else {
          audioCtx.close();
          return reject(new Error('No audio stream available. Enable autoplay permissions or use Browser Speech API.'));
        }
        
        const chunks = [];
        const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
        
        recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'audio/webm' });
          if (source) source.disconnect();
          audioCtx.close();
          resolve(blob);
        };
        
        recorder.start();
        const stopRecorder = () => { if (recorder.state === 'recording') recorder.stop(); };
        
        video.addEventListener('pause', stopRecorder, { once: true });
        video.addEventListener('ended', stopRecorder, { once: true });
        
        setTimeout(() => {
          if (recorder.state === 'recording') {
            stopRecorder();
          }
        }, 30000);
        
      } catch (e) {
        reject(new Error('Audio capture failed: ' + e.message));
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
      let maxTime = 30;
      let timer;
      
      recognition.onresult = (event) => {
        const result = event.results[event.results.length - 1];
        results.push(result[0].transcript);
      };
      
      recognition.onerror = (e) => {
        clearTimeout(timer);
        reject(new Error(`Speech API: ${e.error}`));
      };
      
      recognition.onend = () => {
        clearTimeout(timer);
        const duration = (video.duration && video.duration !== Infinity) ? video.duration : maxTime;
        resolve([{ start: 0, end: duration, text: results.join(' ') }]);
      };
      
      try {
        recognition.start();
      } catch (e) {
        return reject(new Error('Speech recognition failed to start'));
      }
      
      timer = setTimeout(() => {
        recognition.stop();
      }, maxTime * 1000);
      
      if (!video.paused) video.play().catch(() => {});
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
      syncOverlayPosition(video, container);
      const t = video.currentTime;
      const cue = cues.find(c => t >= c.start && t <= c.end);
      
      if (!cue) {
        if (current) { current.remove(); current = null; }
        return;
      }
      
      if (current && current.textContent === cue.text) {
        syncOverlayPosition(video, container);
        return;
      }
      
      if (current) current.remove();
      const el = document.createElement('div');
      el.className = 'subtitle-line';
      el.textContent = cue.text;
      container.appendChild(el);
      current = el;
      syncOverlayPosition(video, container);
    };
    
    const onTimeUpdate = () => { update(); };
    const onSeeked = () => { update(); };
    const onScroll = () => { syncOverlayPosition(video, container); };
    
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('pause', () => { if (current) current.remove(); });
    
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    video.addEventListener('ended', () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('seeked', onSeeked);
      if (current) current.remove();
    });
    
    update();
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
