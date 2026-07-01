const UPLOAD_ALWAYS = true;

export async function transcribeWithAI(audioBlob, apiKey, provider = 'openai') {
  let endpoint;
  let headers = { 'Authorization': `Bearer ${apiKey}` };
  let body;

  if (provider === 'openai') {
    endpoint = 'https://api.openai.com/v1/audio/transcriptions';
    body = new FormData();
    body.append('file', audioBlob, 'audio.webm');
    body.append('model', 'whisper-1');
    body.append('response_format', 'vtt');
  } else if (provider === 'deepgram') {
    endpoint = 'https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&language=en';
    headers['Content-Type'] = 'audio/webm';
    body = await audioBlob.arrayBuffer();
  } else if (provider === 'assemblyai') {
    endpoint = 'https://api.assemblyai.com/v2/transcript';
    body = JSON.stringify({ audio_url: null, language_code: 'en' });
    headers['Content-Type'] = 'application/json';
  } else {
    throw new Error(`Unsupported AI provider: ${provider}`);
  }

  const response = await fetch(endpoint, { method: 'POST', headers, body });
  if (!response.ok) throw new Error(`AI transcription failed: ${response.statusText}`);
  
  const text = await response.text();
  return parseVTT(text);
}

export function parseVTT(vttText) {
  const cues = [];
  const lines = vttText.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const match = line.match(/(\d{2}):(\d{2}):(\d{2}\.\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}\.\d{3})/);
    if (match) {
      const start = toSeconds(match[1], match[2], match[3]);
      const end = toSeconds(match[4], match[5], match[6]);
      let text = '';
      i++;
      while (i < lines.length && lines[i].trim().length > 0) {
        text += (text ? '\n' : '') + lines[i].replace(/<[^>]+>/g, '').trim();
        i++;
      }
      if (text) cues.push({ start, end, text });
    }
    i++;
  }
  return cues;
}

function toSeconds(h, m, s) {
  return parseInt(h) * 3600 + parseInt(m) * 60 + parseFloat(s);
}

export async function transcribeWithWebSpeech(audioBuffer, onProgress) {
  const chunks = [];
  const sampleRate = 16000;
  const mimeType = 'audio/webm;codecs=opus';
  
  const audioContext = new OfflineAudioContext(1, audioBuffer.length, sampleRate);
  const buffer = audioContext.createBuffer(1, audioBuffer.length, sampleRate);
  buffer.getChannelData(0).set(new Float32Array(audioBuffer));
  
  const source = audioContext.createBufferSource();
  source.buffer = buffer;
  source.connect(audioContext.destination);
  source.start();
  
  const rendered = await audioContext.startRendering();
  const wav = toWav(rendered);
  
  return new Promise((resolve, reject) => {
    const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    
    recognition.onresult = (event) => {
      const transcript = [];
      for (let i = 0; i < event.results.length; i++) {
        transcript.push(event.results[i][0].transcript);
      }
      onProgress && onProgress(transcript.join(' '));
    };
    
    recognition.onerror = (e) => reject(new Error('Speech recognition error: ' + e.error));
    recognition.onend = () => resolve(transcript.join(' '));
    recognition.start();
  });
}

export function blobToArrayBuffer(blob) {
  return blob.arrayBuffer();
}

export function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function extractAudioFromVideo(videoElement) {
  return new Promise((resolve, reject) => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioCtx.createMediaElementSource(videoElement);
      const dest = audioCtx.createMediaStreamDestination();
      source.connect(dest);
      source.connect(audioCtx.destination);
      
      const stream = dest.stream;
      const audioChunks = [];
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.push(e.data);
      };
      
      recorder.onstop = () => {
        const blob = new Blob(audioChunks, { type: 'audio/webm' });
        source.disconnect();
        audioCtx.close();
        resolve(blob);
      };
      
      recorder.start();
      setTimeout(() => recorder.stop(), 5000);
      
      videoElement.addEventListener('ended', () => {
        if (recorder.state === 'recording') recorder.stop();
      });
    } catch (e) {
      reject(e);
    }
  });
}

function toWav(renderedBuffer) {
  const numFrames = renderedBuffer.length;
  const numChannels = renderedBuffer.numberOfChannels;
  const sampleRate = renderedBuffer.sampleRate;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numFrames * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  
  const writeString = (offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);
  
  const channelData = renderedBuffer.getChannelData(0);
  let offset = 44;
  for (let i = 0; i < numFrames; i++) {
    const sample = Math.max(-1, Math.min(1, channelData[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
    offset += 2;
  }
  
  return buffer;
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function formatTime(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}
