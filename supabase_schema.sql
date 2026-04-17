-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table for Saved Cloned Voices
CREATE TABLE public.saved_voices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    voice_name TEXT NOT NULL,
    clone_path TEXT NOT NULL,
    native_language TEXT DEFAULT 'en',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for Audio Tracks (Generated MP3s)
CREATE TABLE public.audio_tracks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    extraction_text TEXT,
    language_code TEXT DEFAULT 'en-US',
    mp3_path TEXT NOT NULL,
    voice_id UUID REFERENCES public.saved_voices(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for Playlists
CREATE TABLE public.playlists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Association Table: Playlist Tracks (Many-to-Many between Playlist and AudioTracks)
CREATE TABLE public.playlist_tracks (
    playlist_id UUID REFERENCES public.playlists(id) ON DELETE CASCADE,
    track_id UUID REFERENCES public.audio_tracks(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (playlist_id, track_id)
);

-- Table for Favorites
CREATE TABLE public.favorites (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    track_id UUID REFERENCES public.audio_tracks(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, track_id)
);

-- Row Level Security (RLS) Setup
ALTER TABLE public.saved_voices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audio_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlist_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can only see and modify their own records

-- Saved Voices
CREATE POLICY "Users can manage their own saved voices" 
ON public.saved_voices FOR ALL USING (auth.uid() = user_id);

-- Audio Tracks
CREATE POLICY "Users can manage their own audio tracks" 
ON public.audio_tracks FOR ALL USING (auth.uid() = user_id);

-- Playlists
CREATE POLICY "Users can manage their own playlists" 
ON public.playlists FOR ALL USING (auth.uid() = user_id);

-- Playlist Tracks
CREATE POLICY "Users can manage their own playlist tracks" 
ON public.playlist_tracks FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.playlists p 
        WHERE p.id = playlist_id AND p.user_id = auth.uid()
    )
);

-- Favorites
CREATE POLICY "Users can manage their own favorites" 
ON public.favorites FOR ALL USING (auth.uid() = user_id);
