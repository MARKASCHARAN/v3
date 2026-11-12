'use client';

import { Languages, Mic, Play, Volume2 } from 'lucide-react';
import { FormEvent, useCallback, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  inputClassName,
} from '@/components/ui/primitives';
import { useAsyncResource } from '@/hooks/use-async-resource';
import { ApiClientError } from '@/lib/api-client';
import { voiceApi } from '@/lib/v3-api';
import { VoiceCommandResult } from '@/types/api';

const languages = [
  { code: 'en', label: 'English (en)' },
  { code: 'hi', label: 'Hindi (hi)' },
  { code: 'te', label: 'Telugu (te)' },
  { code: 'ta', label: 'Tamil (ta)' },
  { code: 'kn', label: 'Kannada (kn)' },
  { code: 'mr', label: 'Marathi (mr)' },
];

export function VoiceView() {
  const [commandText, setCommandText] = useState('');
  const [sourceLanguage, setSourceLanguage] = useState('en');
  const [targetLanguage, setTargetLanguage] = useState('en');
  const [synthesizeReply, setSynthesizeReply] = useState(false);
  const [runningCommand, setRunningCommand] = useState(false);
  const [commandResult, setCommandResult] = useState<VoiceCommandResult | null>(null);

  const [translateInput, setTranslateInput] = useState('');
  const [translatedOutput, setTranslatedOutput] = useState<string | null>(null);
  const [ttsText, setTtsText] = useState('');
  const [ttsLang, setTtsLang] = useState('en');
  const [ttsSignedUrl, setTtsSignedUrl] = useState<string | null>(null);

  const [audioBase64, setAudioBase64] = useState('');
  const [asrLang, setAsrLang] = useState('hi');
  const [asrTranscript, setAsrTranscript] = useState<string | null>(null);

  const fetchSessions = useCallback(() => voiceApi.listSessions(20), []);
  const {
    data: sessions,
    error,
    setError,
    loading,
    reload,
  } = useAsyncResource(fetchSessions, 'Failed to load voice sessions');

  const handleFileChange = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const base64Part = result.includes(',') ? (result.split(',')[1] ?? '') : result;
      setAudioBase64(base64Part);
    };
    reader.readAsDataURL(file);
  };

  const handleTranscribe = async (event: FormEvent) => {
    event.preventDefault();
    if (!audioBase64.trim()) return;
    try {
      const res = await voiceApi.transcribe({
        audioBase64: audioBase64.trim(),
        sourceLanguage: asrLang,
        audioFormat: 'wav',
      });
      setAsrTranscript(res.transcript);
      await reload();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Bhashini ASR failed');
    }
  };

  const handleTranslate = async (event: FormEvent) => {
    event.preventDefault();
    if (!translateInput.trim()) return;
    try {
      const res = await voiceApi.translate({
        text: translateInput.trim(),
        sourceLanguage,
        targetLanguage,
      });
      setTranslatedOutput(res.translatedText);
      await reload();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Bhashini translation failed');
    }
  };

  const handleSynthesize = async (event: FormEvent) => {
    event.preventDefault();
    if (!ttsText.trim()) return;
    try {
      const res = await voiceApi.synthesize({
        text: ttsText.trim(),
        languageCode: ttsLang,
      });
      setTtsSignedUrl(res.signedUrl);
      await reload();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Bhashini TTS failed');
    }
  };

  const handleVoiceCommand = async (event: FormEvent) => {
    event.preventDefault();
    if (!commandText.trim()) return;
    setRunningCommand(true);
    try {
      const res = await voiceApi.processCommand({
        transcriptText: commandText.trim(),
        sourceLanguage,
        targetLanguage,
        executeCommand: true,
        synthesizeReply,
      });
      setCommandResult(res);
      setCommandText('');
      await reload();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Voice command execution failed');
    } finally {
      setRunningCommand(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-950">
          Bhashini Multilingual Voice Studio
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          ASR speech-to-text, cross-language translation, Supabase Storage TTS synthesis, and voice orchestration.
        </p>
      </div>

      {error && <ErrorBanner message={error} />}

      <Card className="space-y-4">
        <div className="flex items-center gap-2">
          <Mic className="h-4 w-4 text-orange-500" />
          <h2 className="text-base font-bold text-neutral-950">Voice Command Pipeline</h2>
        </div>
        <form onSubmit={handleVoiceCommand} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <select
              value={sourceLanguage}
              onChange={(e) => setSourceLanguage(e.target.value)}
              className={inputClassName}
            >
              {languages.map((l) => (
                <option key={l.code} value={l.code}>
                  From: {l.label}
                </option>
              ))}
            </select>
            <select
              value={targetLanguage}
              onChange={(e) => setTargetLanguage(e.target.value)}
              className={inputClassName}
            >
              {languages.map((l) => (
                <option key={l.code} value={l.code}>
                  To: {l.label}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-xs font-medium text-neutral-600 lg:col-span-2">
              <input
                type="checkbox"
                checked={synthesizeReply}
                onChange={(e) => setSynthesizeReply(e.target.checked)}
                className="accent-orange-500"
              />
              Synthesize localized Bhashini TTS audio to Supabase Storage
            </label>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <input
              type="text"
              required
              value={commandText}
              onChange={(e) => setCommandText(e.target.value)}
              placeholder="Enter spoken phrase or command in source language..."
              className={`w-full sm:flex-1 ${inputClassName}`}
            />
            <Button type="submit" disabled={runningCommand} className="w-full sm:w-auto">
              <Play className="h-4 w-4" />
              {runningCommand ? 'Executing...' : 'Run Voice Command'}
            </Button>
          </div>
        </form>

        {commandResult && (
          <div className="v3-black-panel space-y-2 rounded-2xl p-4 text-sm text-white">
            <p className="text-xs font-mono text-orange-400">
              TRANSLATED INTENT: {commandResult.translatedText}
            </p>
            <p className="leading-relaxed text-neutral-100">{commandResult.replyText}</p>
            {commandResult.signedUrl && (
              <audio controls src={commandResult.signedUrl} className="mt-2 w-full" />
            )}
          </div>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="space-y-3">
          <div className="flex items-center gap-2">
            <Mic className="h-4 w-4 text-orange-500" />
            <h2 className="text-sm font-bold text-neutral-950">ASR Audio Transcription</h2>
          </div>
          <form onSubmit={handleTranscribe} className="space-y-3">
            <select
              value={asrLang}
              onChange={(e) => setAsrLang(e.target.value)}
              className={inputClassName}
            >
              {languages.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
            <input
              type="file"
              accept="audio/*"
              onChange={(e) => handleFileChange(e.target.files?.[0])}
              className="block w-full text-xs text-neutral-600 file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-950 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
            />
            <Button type="submit" variant="dark" className="w-full" disabled={!audioBase64}>
              Transcribe Audio
            </Button>
          </form>
          {asrTranscript && (
            <p className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-800">
              {asrTranscript}
            </p>
          )}
        </Card>

        <Card className="space-y-3">
          <div className="flex items-center gap-2">
            <Languages className="h-4 w-4 text-orange-500" />
            <h2 className="text-sm font-bold text-neutral-950">Bhashini Translator</h2>
          </div>
          <form onSubmit={handleTranslate} className="space-y-3">
            <textarea
              rows={3}
              required
              value={translateInput}
              onChange={(e) => setTranslateInput(e.target.value)}
              placeholder={`Translate ${sourceLanguage} -> ${targetLanguage}...`}
              className={inputClassName}
            />
            <Button type="submit" variant="dark" className="w-full">
              Translate Text
            </Button>
          </form>
          {translatedOutput && (
            <p className="rounded-xl border border-orange-200 bg-orange-50 p-3 text-xs font-medium text-orange-950">
              {translatedOutput}
            </p>
          )}
        </Card>

        <Card className="space-y-3">
          <div className="flex items-center gap-2">
            <Volume2 className="h-4 w-4 text-orange-500" />
            <h2 className="text-sm font-bold text-neutral-950">TTS Audio Synthesis</h2>
          </div>
          <form onSubmit={handleSynthesize} className="space-y-3">
            <select
              value={ttsLang}
              onChange={(e) => setTtsLang(e.target.value)}
              className={inputClassName}
            >
              {languages.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
            <textarea
              rows={2}
              required
              value={ttsText}
              onChange={(e) => setTtsText(e.target.value)}
              placeholder="Text to synthesize into WAV asset..."
              className={inputClassName}
            />
            <Button type="submit" className="w-full">
              Synthesize & Upload
            </Button>
          </form>
          {ttsSignedUrl && <audio controls src={ttsSignedUrl} className="w-full" />}
        </Card>
      </div>

      <Card className="space-y-3">
        <h2 className="text-base font-bold text-neutral-950">Voice & Telephony Session Logs</h2>
        {loading ? (
          <p className="text-sm text-neutral-500">Loading voice sessions...</p>
        ) : (sessions ?? []).length === 0 ? (
          <EmptyState
            title="No voice sessions recorded"
            description="Voice commands, transcriptions, and telephony calls appear here."
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {(sessions ?? []).map((vs) => (
              <div
                key={vs.id}
                className="space-y-1.5 rounded-xl border border-neutral-200 bg-neutral-50/70 p-3 text-xs"
              >
                <div className="flex items-center justify-between">
                  <Badge tone="orange">{vs.languageCode}</Badge>
                  <Badge tone={vs.status === 'COMPLETED' ? 'green' : 'dark'}>{vs.status}</Badge>
                </div>
                {vs.asrTranscript && (
                  <p className="text-neutral-800">
                    <span className="font-semibold">Transcript:</span> {vs.asrTranscript}
                  </p>
                )}
                {vs.translatedText && (
                  <p className="text-neutral-600">
                    <span className="font-semibold">Translated:</span> {vs.translatedText}
                  </p>
                )}
                {vs.ttsAudioKey && (
                  <p className="break-all font-mono text-[11px] text-neutral-400">{vs.ttsAudioKey}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

