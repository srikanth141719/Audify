'use client'

import React, { useRef, useState } from 'react'
import { Play, Pause, Volume2, VolumeX, Download, Heart, Plus, Settings2 } from 'lucide-react'

export interface Timestamp {
  word: string
  start: number
  end: number
}

interface AudioPlayerProps {
  audioUrl: string
  timestamps: Timestamp[]
  onWordChange: (index: number) => void
  onSaveToLibrary: () => void
  onFavorite: () => void
}

export default function AudioPlayer({ audioUrl, timestamps, onWordChange, onSaveToLibrary, onFavorite }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [showSettings, setShowSettings] = useState(false)

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
      } else {
        audioRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const current = audioRef.current.currentTime
      const duration = audioRef.current.duration
      setProgress((current / duration) * 100)

      // Time-stamp matching logic
      if (timestamps && timestamps.length > 0) {
        const idx = timestamps.findIndex(t => current >= t.start && current <= t.end)
        if (idx !== -1 && idx !== activeIndex) {
          setActiveIndex(idx)
          onWordChange(idx)
        }
      }
    }
  }

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (audioRef.current) {
      const bounds = e.currentTarget.getBoundingClientRect()
      const percent = (e.clientX - bounds.left) / bounds.width
      audioRef.current.currentTime = percent * audioRef.current.duration
      setProgress(percent * 100)
    }
  }

  const changeSpeed = (newSpeed: number) => {
    if (audioRef.current) {
      audioRef.current.playbackRate = newSpeed
      setSpeed(newSpeed)
      setShowSettings(false)
    }
  }

  return (
    <div className="bg-white/80 dark:bg-[#2c2824]/80 backdrop-blur-xl shadow-2xl rounded-2xl p-6 border border-[#e8dfd3] dark:border-[#4e453e] sticky bottom-6">
      <audio 
        ref={audioRef} 
        src={audioUrl} 
        onTimeUpdate={handleTimeUpdate} 
        onEnded={() => setIsPlaying(false)}
      />
      
      {/* Progress Bar */}
      <div 
        className="w-full h-2 bg-[#f4ecd8] dark:bg-[#1a1714] rounded-full mb-6 cursor-pointer overflow-hidden"
        onClick={handleTimelineClick}
      >
        <div 
          className="h-full bg-gradient-to-r from-[#8b5a2b] to-[#c69c6d] transition-all duration-100 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex items-center justify-between">
        
        {/* Left Controls */}
        <div className="flex items-center gap-4">
          <button 
            onClick={togglePlay}
            className="w-12 h-12 flex items-center justify-center bg-[#8b5a2b] text-white rounded-full hover:bg-[#704822] hover:scale-105 transition-all shadow-md shadow-[#8b5a2b]/30"
          >
            {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-1" />}
          </button>
          
          <div className="flex items-center gap-2 group">
            <button onClick={() => {
              setIsMuted(!isMuted)
              if (audioRef.current) audioRef.current.muted = !isMuted
            }} className="text-[#795548] dark:text-[#a1887f] hover:text-[#8b5a2b]">
              {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>
            <input 
              type="range" 
              min="0" max="1" step="0.01" 
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                const val = parseFloat(e.target.value)
                setVolume(val)
                setIsMuted(val === 0)
                if (audioRef.current) audioRef.current.volume = val
              }}
              className="w-0 opacity-0 group-hover:w-24 group-hover:opacity-100 transition-all duration-300 accent-[#8b5a2b]"
            />
          </div>
        </div>

        {/* Center Title (Optional) */}
        <div className="hidden md:block text-center flex-1">
          <p className="text-sm font-semibold tracking-wide text-[#3e2723] dark:text-[#d4ba9f]">Now Playing</p>
          <p className="text-xs text-[#795548] dark:text-[#8d6e63]">Generated Audiobook</p>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-3 relative">
          
          <div className="relative">
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 text-[#795548] dark:text-[#a1887f] hover:text-[#8b5a2b] hover:bg-[#f4ecd8] dark:hover:bg-[#3d3732] rounded-full transition-colors flex items-center gap-1"
            >
              <Settings2 size={18} />
              <span className="text-xs font-mono">{speed}x</span>
            </button>
            
            {showSettings && (
              <div className="absolute bottom-full right-0 mb-2 bg-white dark:bg-[#3d3732] border border-[#e8dfd3] dark:border-[#4e453e] rounded-lg shadow-xl overflow-hidden flex flex-col z-10 w-24">
                {[0.5, 0.75, 1, 1.25, 1.5, 2].map(s => (
                  <button 
                    key={s} 
                    onClick={() => changeSpeed(s)}
                    className={`px-4 py-2 text-sm text-left hover:bg-[#f4ecd8] dark:hover:bg-[#2c2824] ${speed === s ? 'text-[#8b5a2b] font-bold' : 'text-[#795548] dark:text-[#d4ba9f]'}`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="w-px h-6 bg-[#e8dfd3] dark:bg-[#4e453e] mx-1"></div>

          <button onClick={onSaveToLibrary} className="p-2 text-[#795548] dark:text-[#a1887f] hover:text-[#8b5a2b] hover:bg-[#f4ecd8] dark:hover:bg-[#3d3732] rounded-full transition-colors" title="Save to Library">
            <Plus size={18} />
          </button>
          <button onClick={onFavorite} className="p-2 text-[#795548] dark:text-[#a1887f] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors" title="Add to Favorites">
            <Heart size={18} />
          </button>
          
          <a download href={audioUrl} className="p-2 text-[#795548] dark:text-[#a1887f] hover:text-[#8b5a2b] hover:bg-[#f4ecd8] dark:hover:bg-[#3d3732] rounded-full transition-colors" title="Download MP3">
            <Download size={18} />
          </a>
        </div>
      </div>
    </div>
  )
}
