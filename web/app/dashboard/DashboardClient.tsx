'use client'

import React, { useState } from 'react'
import { Upload, Mic, BookOpen, Fingerprint, Loader2, Play, User, Heart, Library, Download, Languages, Sparkles } from 'lucide-react'
import AudioPlayer, { Timestamp } from '@/components/AudioPlayer'

interface DashboardClientProps {
  userEmail: string
  userId: string
}

type NavSection = 'studio' | 'profile' | 'favorites' | 'library' | 'downloads' | 'voices'

type SavedVoice = {
  id: string
  name: string
  language: string
  createdAt: number
}

type SavedTrack = {
  id: string
  title: string
  audioUrl: string
  createdAt: number
  language: string
  textPreview: string
}

type LanguageOption = {
  code: string
  name: string
}

type GenerationMetadata = {
  title: string
}

type ApiErrorPayload = {
  detail?: string
}

const LS_KEYS = {
  voices: 'audify.savedVoices.v1',
  library: 'audify.library.v1',
  favorites: 'audify.favorites.v1',
  downloads: 'audify.downloads.v1',
}

const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: 'af', name: 'Afrikaans' },
  { code: 'ar', name: 'Arabic' },
  { code: 'bg', name: 'Bulgarian' },
  { code: 'bn', name: 'Bengali' },
  { code: 'ca', name: 'Catalan' },
  { code: 'cs', name: 'Czech' },
  { code: 'da', name: 'Danish' },
  { code: 'de', name: 'German' },
  { code: 'el', name: 'Greek' },
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'et', name: 'Estonian' },
  { code: 'fa', name: 'Persian' },
  { code: 'fi', name: 'Finnish' },
  { code: 'fil', name: 'Filipino' },
  { code: 'fr', name: 'French' },
  { code: 'gu', name: 'Gujarati' },
  { code: 'he', name: 'Hebrew' },
  { code: 'hi', name: 'Hindi' },
  { code: 'hr', name: 'Croatian' },
  { code: 'hu', name: 'Hungarian' },
  { code: 'id', name: 'Indonesian' },
  { code: 'is', name: 'Icelandic' },
  { code: 'it', name: 'Italian' },
  { code: 'ja', name: 'Japanese' },
  { code: 'kn', name: 'Kannada' },
  { code: 'ko', name: 'Korean' },
  { code: 'lt', name: 'Lithuanian' },
  { code: 'lv', name: 'Latvian' },
  { code: 'ml', name: 'Malayalam' },
  { code: 'mr', name: 'Marathi' },
  { code: 'ms', name: 'Malay' },
  { code: 'nl', name: 'Dutch' },
  { code: 'no', name: 'Norwegian' },
  { code: 'pa', name: 'Punjabi' },
  { code: 'pl', name: 'Polish' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ro', name: 'Romanian' },
  { code: 'ru', name: 'Russian' },
  { code: 'sk', name: 'Slovak' },
  { code: 'sl', name: 'Slovenian' },
  { code: 'sr', name: 'Serbian' },
  { code: 'sv', name: 'Swedish' },
  { code: 'sw', name: 'Swahili' },
  { code: 'ta', name: 'Tamil' },
  { code: 'te', name: 'Telugu' },
  { code: 'th', name: 'Thai' },
  { code: 'tr', name: 'Turkish' },
  { code: 'uk', name: 'Ukrainian' },
  { code: 'ur', name: 'Urdu' },
  { code: 'vi', name: 'Vietnamese' },
  { code: 'zh-cn', name: 'Chinese (Simplified)' },
]

const CLONE_SUPPORTED_LANGS = new Set([
  'ar', 'cs', 'de', 'en', 'es', 'fr', 'hi', 'hu', 'it', 'ja', 'ko', 'nl', 'pl', 'pt', 'ru', 'tr', 'zh-cn',
])

function safeJsonParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message
  return fallback
}

export default function DashboardClient({ userEmail, userId }: DashboardClientProps) {
  const [section, setSection] = useState<NavSection>('studio')

  // UI States
  const [text, setText] = useState("")
  const [sourceLanguage, setSourceLanguage] = useState("en")
  const [language, setLanguage] = useState("en")
  const [engineType, setEngineType] = useState<"standard" | "premium">("standard")
  const [voiceType, setVoiceType] = useState<"female" | "male" | "custom">("female")
  const [customVoiceFile, setCustomVoiceFile] = useState<File | null>(null)
  const [savedVoices, setSavedVoices] = useState<SavedVoice[]>(
    () => safeJsonParse<SavedVoice[]>(typeof window === 'undefined' ? null : window.localStorage.getItem(LS_KEYS.voices), [])
  )
  const [selectedSavedVoiceId, setSelectedSavedVoiceId] = useState<string>("")

  // Generation States
  const [isExtracting, setIsExtracting] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSummarizing, setIsSummarizing] = useState(false)
  const [isTranslating, setIsTranslating] = useState(false)

  // Result States
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [timestamps, setTimestamps] = useState<Timestamp[]>([])
  const [activeWordIndex, setActiveWordIndex] = useState(-1)
  const [generationMetadata, setGenerationMetadata] = useState<GenerationMetadata | null>(null)
  const [summary, setSummary] = useState<string>("")
  const [translatedText, setTranslatedText] = useState<string>("")
  const [audioText, setAudioText] = useState<string>("")
  const [sourceSearch, setSourceSearch] = useState("")
  const [targetSearch, setTargetSearch] = useState("")

  const [library, setLibrary] = useState<SavedTrack[]>(
    () => safeJsonParse<SavedTrack[]>(typeof window === 'undefined' ? null : window.localStorage.getItem(LS_KEYS.library), [])
  )
  const [favorites, setFavorites] = useState<SavedTrack[]>(
    () => safeJsonParse<SavedTrack[]>(typeof window === 'undefined' ? null : window.localStorage.getItem(LS_KEYS.favorites), [])
  )
  const [downloads, setDownloads] = useState<SavedTrack[]>(
    () => safeJsonParse<SavedTrack[]>(typeof window === 'undefined' ? null : window.localStorage.getItem(LS_KEYS.downloads), [])
  )

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    setIsExtracting(true)

    const file = e.target.files[0]
    const formData = new FormData()
    formData.append("file", file)

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8001'}/api/extract/`, {
        method: "POST",
        body: formData,
      })
      if (!res.ok) throw new Error("Extraction failed")
      const data = await res.json()
      setText(data.text)
      if (data.language && data.language !== 'unknown') {
        const detected = LANGUAGE_OPTIONS.find((l) => l.code === data.language)
        if (detected) {
          setLanguage(detected.code)
          setSourceLanguage(detected.code)
          setSourceSearch("")
          setTargetSearch("")
        }
      }
    } catch {
      alert("Error extracting document text.")
    } finally {
      setIsExtracting(false)
    }
  }

  const persist = (key: string, value: unknown) => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // ignore
    }
  }

  const handleSummarize = async () => {
    if (!text.trim()) {
      alert("Add some text first.")
      return
    }
    setIsSummarizing(true)
    try {
      // 1. If source is not English, translate to English first for BART
      let englishTextToSummarize = text
      if (sourceLanguage !== 'en') {
        const toEnRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8001'}/api/nlp/translate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, source_language: sourceLanguage, target_language: 'en' }),
        })
        if (toEnRes.ok) {
          const toEnData = await toEnRes.json()
          englishTextToSummarize = toEnData.translated_text || text
        }
      }

      // 2. Summarize the English text
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8001'}/api/nlp/summarize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: englishTextToSummarize }),
      })
      if (!res.ok) {
        const detail = (await res.json()) as ApiErrorPayload
        throw new Error(detail.detail || "Summarization failed")
      }
      const data = await res.json()

      // 3. Remove unnecessary quotes from the summary
      let finalSummary = (data.summary || "").replace(/\"/g, '').trim()

      // 4. If target language is not English, translate the clean summary to it
      if (finalSummary && language !== 'en') {
        const transRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8001'}/api/nlp/translate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: finalSummary,
            source_language: 'en',
            target_language: language
          }),
        })
        if (transRes.ok) {
          const transData = await transRes.json()
          finalSummary = transData.translated_text || finalSummary
        }
      }

      setSummary(finalSummary)
    } catch (err: unknown) {
      alert(`Summarization Error: ${getErrorMessage(err, 'Request failed')}`)
    } finally {
      setIsSummarizing(false)
    }
  }

  const handleTranslate = async () => {
    if (!text.trim()) {
      alert("Add some text first.")
      return
    }
    if (sourceLanguage === language) {
      setTranslatedText(text)
      return
    }
    setIsTranslating(true)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8001'}/api/nlp/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, source_language: sourceLanguage, target_language: language }),
      })
      if (!res.ok) {
        const detail = (await res.json()) as ApiErrorPayload
        throw new Error(detail.detail || "Translation failed")
      }
      const data = await res.json()
      setTranslatedText(data.translated_text || "")
    } catch (err: unknown) {
      alert(`Translation Error: ${getErrorMessage(err, 'Request failed')}`)
    } finally {
      setIsTranslating(false)
    }
  }

  const addToCollection = (collection: 'library' | 'favorites' | 'downloads') => {
    if (!audioUrl) return
    const item: SavedTrack = {
      id: crypto.randomUUID(),
      title: generationMetadata?.title || "Generated Audio",
      audioUrl,
      createdAt: Date.now(),
      language,
      textPreview: (translatedText || text).slice(0, 140),
    }
    if (collection === 'library') {
      const next = [item, ...library]
      setLibrary(next)
      persist(LS_KEYS.library, next)
    } else if (collection === 'favorites') {
      const next = [item, ...favorites]
      setFavorites(next)
      persist(LS_KEYS.favorites, next)
    } else {
      const next = [item, ...downloads]
      setDownloads(next)
      persist(LS_KEYS.downloads, next)
    }
  }

  const handleGenerate = async () => {
    if (!text.trim()) {
      alert("Please provide some text to generate.")
      return
    }

    setIsGenerating(true)

    const effectiveText = translatedText || text
    setAudioText(effectiveText)
    const formData = new FormData()
    formData.append("text", effectiveText)
    formData.append("target_language", language)
    formData.append("emotive", "true")
    formData.append("voice_preset", voiceType)
    formData.append("engine_type", engineType)

    try {
      let endpoint = '/api/audio/generate'

      if (engineType === "premium") {
        if (voiceType === "male" || voiceType === "female") {
          const fetchUrl = voiceType === "male" ? "/voices/default_male.wav" : "/voices/default_female.wav"
          try {
            const raw = await fetch(fetchUrl)
            if (!raw.ok) throw new Error("Missing preset")
            if (CLONE_SUPPORTED_LANGS.has(language)) {
              const blob = await raw.blob()
              formData.append("speaker_wav", blob, "speaker.wav")
            }
          } catch {
            if (language !== 'en' && CLONE_SUPPORTED_LANGS.has(language)) {
              alert(`To use powerful non-English emotive features without a custom clone, you must drop ${fetchUrl} into the Next.js public/voices folder!`)
              setIsGenerating(false)
              return
            }
          }
        } else if (voiceType === "custom") {
          if (!customVoiceFile && !selectedSavedVoiceId) {
            alert("Upload a custom voice wav or pick a saved voice.")
            setIsGenerating(false)
            return
          }
          if (customVoiceFile) {
            formData.append("speaker_wav", customVoiceFile, customVoiceFile.name || "speaker.wav")
          } else if (selectedSavedVoiceId) {
            formData.append("voice_id", selectedSavedVoiceId)
          }
        }
      }

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8001'}${endpoint}`,
        {
          method: "POST",
          body: formData,
        }
      )
      if (!res.ok) {
        const detail = (await res.json()) as ApiErrorPayload
        throw new Error(detail.detail || "Audio generation failed")
      }

      const data = await res.json()
      setAudioUrl(data.audio_url)
      setTimestamps(data.timestamps)
      setGenerationMetadata({ title: effectiveText.substring(0, 30) + '...' })
      setActiveWordIndex(-1)

    } catch (err: unknown) {
      alert(`Generation Error: ${getErrorMessage(err, 'Request failed')}`)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSaveVoiceProfile = async () => {
    if (voiceType !== 'custom' || !customVoiceFile) {
      alert("Upload a custom voice file first to save it as a profile!")
      return
    }
    const voiceName = prompt("Enter a name for this custom voice:")
    if (!voiceName) return

    try {
      const formData = new FormData()
      formData.append("file", customVoiceFile)

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8001'}/api/audio/save-voice`, {
        method: 'POST',
        body: formData
      })
      if (!res.ok) throw new Error("Backend save failed")
      const data = await res.json()

      const v: SavedVoice = { id: data.voice_id, name: voiceName, language, createdAt: Date.now() }
      const next = [v, ...savedVoices]
      setSavedVoices(next)
      persist(LS_KEYS.voices, next)
      setSelectedSavedVoiceId(v.id)
      alert("Voice profile saved to server and linked into your local profile!")
    } catch (err: unknown) {
      alert(`Failed to save: ${getErrorMessage(err, 'Request failed')}`)
    }
  }

  const handleSaveToLibrary = async () => {
    addToCollection('library')
    alert("Saved to Library.")
  }

  const handleFavorite = async () => {
    addToCollection('favorites')
    alert("Added to Favorites.")
  }

  const handleDownloadLogged = () => {
    addToCollection('downloads')
  }

  const TabButton = ({ id, label, icon }: { id: NavSection; label: string; icon: React.ReactNode }) => (
    <button
      onClick={() => setSection(id)}
      className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all text-sm font-medium ${section === id
        ? 'border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500 dark:text-white shadow-md'
        : 'border-transparent hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
        }`}
    >
      <span className="shrink-0">{icon}</span>
      <span>{label}</span>
    </button>
  )

  const TrackList = ({ items, empty }: { items: SavedTrack[]; empty: string }) => (
    <div className="bg-white/60 dark:bg-neutral-900/60 backdrop-blur-xl border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm">
      {items.length === 0 ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">{empty}</p>
      ) : (
        <div className="space-y-3">
          {items.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-4 p-4 rounded-xl bg-white/40 dark:bg-neutral-950/40 backdrop-blur-lg border border-neutral-200 dark:border-neutral-800">
              <div className="min-w-0">
                <p className="font-bold truncate">{t.title}</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{t.textPreview}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a className="px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:bg-white dark:hover:bg-neutral-900" href={t.audioUrl} target="_blank" rel="noreferrer">
                  Open
                </a>
                <a className="px-3 py-2 rounded-lg bg-emerald-600 dark:bg-emerald-500 text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200" download href={t.audioUrl} onClick={handleDownloadLogged}>
                  Download
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  const sourceCandidates = LANGUAGE_OPTIONS.filter((lang) =>
    `${lang.name} ${lang.code}`.toLowerCase().includes(sourceSearch.toLowerCase())
  )
  const targetCandidates = LANGUAGE_OPTIONS.filter((lang) => {
    if (engineType === 'premium' && !CLONE_SUPPORTED_LANGS.has(lang.code)) return false;
    return `${lang.name} ${lang.code}`.toLowerCase().includes(targetSearch.toLowerCase())
  })
  const audioWords = audioText.trim() ? audioText.trim().split(/\s+/) : []

  return (
    <div className="space-y-6">
      {/* Horizontal Nav */}
      <div className="flex flex-wrap items-center gap-2 pb-4 border-b border-neutral-200 dark:border-neutral-800">
        <TabButton id="studio" label="Studio" icon={<Play size={16} />} />
        <TabButton id="profile" label="Profile" icon={<User size={16} />} />
        <TabButton id="favorites" label="Favorites" icon={<Heart size={16} />} />
        <TabButton id="library" label="Library" icon={<Library size={16} />} />
        <TabButton id="downloads" label="Downloads" icon={<Download size={16} />} />
        <TabButton id="voices" label="Saved Voices" icon={<Mic size={16} />} />
      </div>

      {/* Content */}
      <div className="space-y-6">
        {section !== 'studio' ? (
          <>
            {section === 'profile' && (
              <div className="bg-white/60 dark:bg-neutral-900/60 backdrop-blur-xl border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm">
                <h2 className="text-xl font-bold mb-2">Profile</h2>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">Local prototype profile view. (Hook this to Supabase tables when ready.)</p>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-white/40 dark:bg-neutral-950/40 backdrop-blur-lg border border-neutral-200 dark:border-neutral-800">
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">Email</p>
                    <p className="font-bold break-all">{userEmail}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-white/40 dark:bg-neutral-950/40 backdrop-blur-lg border border-neutral-200 dark:border-neutral-800">
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">User ID</p>
                    <p className="font-mono text-xs break-all">{userId}</p>
                  </div>
                </div>
              </div>
            )}

            {section === 'favorites' && <TrackList items={favorites} empty="No favorites yet. Generate audio in Studio, then tap the heart." />}
            {section === 'library' && <TrackList items={library} empty="Library is empty. Generate audio in Studio, then tap the plus icon." />}
            {section === 'downloads' && <TrackList items={downloads} empty="No downloads logged yet. Download a track from the player or lists." />}
            {section === 'voices' && (
              <div className="bg-white/60 dark:bg-neutral-900/60 backdrop-blur-xl border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm">
                <h2 className="text-xl font-bold mb-4">Saved Voices</h2>
                {savedVoices.length === 0 ? (
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">No saved voices yet. In Studio, upload a custom voice and click “Save Voice to Profile DB”.</p>
                ) : (
                  <div className="space-y-3">
                    {savedVoices.map(v => (
                      <div key={v.id} className="flex items-center justify-between gap-4 p-4 rounded-xl bg-white/40 dark:bg-neutral-950/40 backdrop-blur-lg border border-neutral-200 dark:border-neutral-800">
                        <div>
                          <p className="font-bold">{v.name}</p>
                          <p className="text-xs text-neutral-500 dark:text-neutral-400">Language: {v.language}</p>
                        </div>
                        <button
                          className={`px-4 py-2 rounded-lg border ${selectedSavedVoiceId === v.id ? 'border-emerald-600 dark:border-emerald-500 text-emerald-600 dark:text-emerald-500' : 'border-neutral-200 dark:border-neutral-800'}`}
                          onClick={() => setSelectedSavedVoiceId(v.id)}
                        >
                          {selectedSavedVoiceId === v.id ? 'Selected' : 'Select'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-4">
                  Note: cloning still needs a fresh voice file upload (browsers don’t reliably persist raw audio files for security reasons).
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Actions & Configuration */}
            <div className="space-y-6 lg:col-span-1">

              {/* Document Upload */}
              <div className="bg-white/60 dark:bg-neutral-900/60 backdrop-blur-xl border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <BookOpen className="text-emerald-600 dark:text-emerald-400" size={24} />
                  <h2 className="text-xl font-bold">Import Text</h2>
                </div>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4 leading-relaxed">
                  Upload PDF, Word, EPUB, or extract text directly from Images via our OCR engine.
                </p>
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-neutral-200 dark:border-neutral-800 border-dashed rounded-xl cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-950 transition-colors relative">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    {isExtracting ? <Loader2 className="animate-spin text-emerald-600 dark:text-emerald-500" size={24} /> : <Upload className="text-emerald-600 dark:text-emerald-500 dark:text-neutral-400 mb-2" size={24} />}
                    <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-2 font-medium">Click to upload document</p>
                  </div>
                  <input type="file" className="hidden" onChange={handleDocumentUpload} disabled={isExtracting} />
                </label>
              </div>

              {/* Voice Cloning Configuration */}
              <div className="bg-white/60 dark:bg-neutral-900/60 backdrop-blur-xl border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <Fingerprint className="text-emerald-600 dark:text-emerald-400" size={24} />
                  <h2 className="text-xl font-bold">Voice Model</h2>
                </div>

                <div className="space-y-4">
                  <div className="bg-white/40 dark:bg-neutral-950/40 backdrop-blur-lg border border-neutral-200 dark:border-neutral-800 rounded-xl p-1 flex mb-4">
                    <button
                      onClick={() => setEngineType("standard")}
                      className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${engineType === 'standard' ? 'bg-emerald-600 text-white shadow-md' : 'text-neutral-600 dark:text-neutral-400 hover:text-emerald-600'}`}
                    >
                      Standard
                    </button>
                    <button
                      onClick={() => setEngineType("premium")}
                      className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${engineType === 'premium' ? 'bg-emerald-600 text-white shadow-md' : 'text-neutral-600 dark:text-neutral-400 hover:text-emerald-600'}`}
                    >
                      Premium
                    </button>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-2 text-neutral-700 dark:text-neutral-300">Source Language (detected)</label>
                    <input
                      value={sourceSearch}
                      onChange={(e) => setSourceSearch(e.target.value)}
                      placeholder="Search language..."
                      className="mb-2 w-full bg-white/40 dark:bg-neutral-950/40 backdrop-blur-lg border border-neutral-200 dark:border-neutral-800 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                    <select
                      value={sourceLanguage}
                      onChange={(e) => setSourceLanguage(e.target.value)}
                      className="w-full bg-white/40 dark:bg-neutral-950/40 backdrop-blur-lg border border-neutral-200 dark:border-neutral-800 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 outline-none"
                    >
                      {sourceCandidates.length > 0 ? (
                        sourceCandidates.map((lang) => (
                          <option key={lang.code} value={lang.code}>
                            {lang.name} ({lang.code})
                          </option>
                        ))
                      ) : (
                        <option value={sourceLanguage}>No matching language</option>
                      )}
                    </select>

                    <label className="block text-sm font-semibold mb-2 text-neutral-700 dark:text-neutral-300">Target Language</label>
                    <input
                      value={targetSearch}
                      onChange={(e) => setTargetSearch(e.target.value)}
                      placeholder="Search language..."
                      className="mb-2 w-full bg-white/40 dark:bg-neutral-950/40 backdrop-blur-lg border border-neutral-200 dark:border-neutral-800 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="w-full bg-white/40 dark:bg-neutral-950/40 backdrop-blur-lg border border-neutral-200 dark:border-neutral-800 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 outline-none"
                    >
                      {targetCandidates.length > 0 ? (
                        targetCandidates.map((lang) => (
                          <option key={lang.code} value={lang.code}>
                            {lang.name} ({lang.code})
                          </option>
                        ))
                      ) : (
                        <option value={language}>No matching language</option>
                      )}
                    </select>
                  </div>

                  {engineType === 'premium' && (
                    <div className="pt-2">
                      <label className="block text-sm font-semibold mb-3 text-neutral-700 dark:text-neutral-300">Voice Signature</label>
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <button
                          onClick={() => setVoiceType("female")}
                          className={`p-3 rounded-xl border text-sm font-medium transition-all ${voiceType === 'female' ? 'border-emerald-600 dark:border-emerald-500 bg-emerald-600/10 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-500' : 'border-neutral-200 dark:border-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-950'}`}
                        >
                          Female Reader
                        </button>
                        <button
                          onClick={() => setVoiceType("male")}
                          className={`p-3 rounded-xl border text-sm font-medium transition-all ${voiceType === 'male' ? 'border-emerald-600 dark:border-emerald-500 bg-emerald-600/10 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-500' : 'border-neutral-200 dark:border-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-950'}`}
                        >
                          Male Reader
                        </button>
                      </div>

                      <div className="mt-4 border-t border-neutral-200 dark:border-neutral-800 pt-4">
                        <button
                          onClick={() => setVoiceType("custom")}
                          className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${voiceType === 'custom' ? 'border-emerald-600 dark:border-emerald-500 bg-emerald-600/10 dark:bg-emerald-500/10' : 'border-neutral-200 dark:border-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-950'}`}
                        >
                          <span className="text-sm font-medium">Custom Clone (.wav)</span>
                          <Mic size={16} />
                        </button>

                        {voiceType === "custom" && (
                          <div className="mt-3 space-y-2">
                            <input
                              type="file"
                              accept=".wav,.mp3"
                              onChange={(e) => setCustomVoiceFile(e.target.files?.[0] || null)}
                              className="text-xs w-full file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-neutral-100 dark:file:bg-neutral-800 file:text-emerald-600 dark:text-emerald-500 dark:file:text-neutral-300 hover:file:bg-[#e8dfd3]"
                            />
                            {customVoiceFile && (
                              <button onClick={handleSaveVoiceProfile} className="text-xs text-emerald-600 dark:text-emerald-500 font-semibold underline decoration-dashed underline-offset-4 w-full text-right hover:text-emerald-800 dark:text-emerald-200">
                                Save Voice to Profile DB
                              </button>
                            )}
                            {savedVoices.length > 0 && (
                              <div className="text-xs text-neutral-500 dark:text-neutral-400">
                                Saved voice selected: <span className="font-semibold">{selectedSavedVoiceId ? (savedVoices.find(v => v.id === selectedSavedVoiceId)?.name || 'None') : 'None'}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <button
                    onClick={handleTranslate}
                    disabled={isTranslating || !text.trim()}
                    className="w-full bg-white/40 dark:bg-neutral-950/40 backdrop-blur-lg border border-neutral-200 dark:border-neutral-800 py-3 px-4 rounded-xl font-bold tracking-wide hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all flex justify-center items-center gap-2 disabled:opacity-50"
                  >
                    <Languages size={16} />
                    {isTranslating ? 'Translating...' : 'Translate'}
                  </button>
                  <button
                    onClick={handleSummarize}
                    disabled={isSummarizing || !text.trim()}
                    className="w-full bg-white/40 dark:bg-neutral-950/40 backdrop-blur-lg border border-neutral-200 dark:border-neutral-800 py-3 px-4 rounded-xl font-bold tracking-wide hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all flex justify-center items-center gap-2 disabled:opacity-50"
                  >
                    {isSummarizing ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                    {isSummarizing ? 'Summarizing (BART-Large)...' : 'Summarize'}
                  </button>
                </div>

                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || !text.trim()}
                  className="w-full mt-8 bg-gradient-to-r from-emerald-500 to-green-600 text-white dark:text-white py-3 px-4 rounded-xl font-bold tracking-wide shadow-lg hover:shadow-xl transition-all flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGenerating ? <Loader2 className="animate-spin" /> : <Play fill="currentColor" size={16} />}
                  {isGenerating ? 'Synthesizing Audio...' : 'Generate Audiobook'}
                </button>

              </div>
            </div>{/* end left column */}

            {/* Right Column: Editor & Playback */}
            <div className="lg:col-span-2 space-y-6 flex flex-col h-full">

              {/* Text Area / Teleprompter State */}
              <div className="bg-white/60 dark:bg-neutral-900/60 backdrop-blur-xl border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm flex-1 flex flex-col min-h-[400px]">
                <div className="flex items-center justify-between mb-4 pb-4 border-b border-neutral-200 dark:border-neutral-800">
                  <h2 className="text-lg font-bold">Manuscript Editor</h2>
                  {timestamps.length > 0 && <span className="text-xs font-mono bg-emerald-600/10 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 px-3 py-1 rounded-full border border-emerald-600/30 dark:border-emerald-500/30">Teleprompter Active</span>}
                </div>

                <div className="grid grid-cols-1 gap-4 flex-1 overflow-y-auto">
                  <div className="rounded-xl bg-white/40 dark:bg-neutral-950/40 backdrop-blur-lg border border-neutral-200 dark:border-neutral-800 p-4">
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">Original</p>
                    <textarea
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder="Paste your chapter here, or upload a document to extract text automatically..."
                      className="w-full bg-transparent resize-none outline-none leading-relaxed text-lg min-h-[220px]"
                    />
                  </div>

                  <div className="rounded-xl bg-white/40 dark:bg-neutral-950/40 backdrop-blur-lg border border-neutral-200 dark:border-neutral-800 p-4">
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">Translated (source → target)</p>
                    {timestamps.length > 0 && audioWords.length > 0 ? (
                      <div className="leading-loose text-base text-justify min-h-[120px]">
                        {audioWords.map((word, idx) => (
                          <span
                            key={`${word}-${idx}`}
                            className={`transition-colors duration-200 cursor-pointer ${idx === activeWordIndex ? 'bg-emerald-600 dark:bg-emerald-500 text-white dark:text-neutral-900 px-1 py-0.5 rounded shadow-sm' : 'hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:dark:bg-neutral-800'}`}
                          >
                            {word}{" "}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <textarea
                        value={translatedText}
                        onChange={(e) => setTranslatedText(e.target.value)}
                        placeholder="Click Translate to fill this, or edit manually."
                        className="w-full bg-transparent resize-none outline-none leading-relaxed text-base min-h-[120px]"
                      />
                    )}
                  </div>

                  <div className="rounded-xl bg-white/40 dark:bg-neutral-950/40 backdrop-blur-lg border border-neutral-200 dark:border-neutral-800 p-4">
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">Summary</p>
                    <textarea
                      value={summary}
                      onChange={(e) => setSummary(e.target.value)}
                      placeholder="Click Summarize to generate a summary."
                      className="w-full bg-transparent resize-none outline-none leading-relaxed text-base min-h-[90px]"
                    />
                  </div>
                </div>
              </div>

              {/* Floating Custom Audio Player */}
              {audioUrl && (
                <div className="w-full">
                  <AudioPlayer
                    audioUrl={audioUrl}
                    timestamps={timestamps}
                    onWordChange={setActiveWordIndex}
                    onSaveToLibrary={handleSaveToLibrary}
                    onFavorite={handleFavorite}
                  />
                </div>
              )}

            </div>
          </div>
        )}
      </div>
    </div>
  )
}
