-- ==============================================================================
-- ReaWid - Supabase PostgreSQL Cloud Database Schema
-- Run this script in your Supabase Dashboard -> SQL Editor
-- ==============================================================================

-- 1. Enable UUID Extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create Books Table
CREATE TABLE IF NOT EXISTS public.books (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  author TEXT DEFAULT '',
  cover TEXT DEFAULT '',
  total_pages INTEGER DEFAULT 1,
  current_page INTEGER DEFAULT 1,
  progress INTEGER DEFAULT 0,
  is_current BOOLEAN DEFAULT false,
  chapter TEXT DEFAULT '',
  chapter_subtitle TEXT DEFAULT '',
  status TEXT DEFAULT 'okunanlar',
  content TEXT DEFAULT '',
  real_page_image TEXT DEFAULT '',
  page_paragraphs JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Notes Table (Notlar, Alıntılar, Yer İmleri)
CREATE TABLE IF NOT EXISTS public.notes (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  book_id TEXT DEFAULT '',
  book_title TEXT DEFAULT '',
  book_author TEXT DEFAULT '',
  page_number INTEGER DEFAULT 1,
  type TEXT DEFAULT 'quote', -- 'quote', 'note', 'bookmark'
  text TEXT DEFAULT '',
  user_note TEXT DEFAULT '',
  date_formatted TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- 5. Row Level Security Policies for Books
-- Users can only read, insert, update, and delete their own books
DROP POLICY IF EXISTS "Users can read own books" ON public.books;
CREATE POLICY "Users can read own books" ON public.books
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own books" ON public.books;
CREATE POLICY "Users can insert own books" ON public.books
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own books" ON public.books;
CREATE POLICY "Users can update own books" ON public.books
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own books" ON public.books;
CREATE POLICY "Users can delete own books" ON public.books
  FOR DELETE USING (auth.uid() = user_id);

-- 6. Row Level Security Policies for Notes
-- Users can only read, insert, update, and delete their own notes
DROP POLICY IF EXISTS "Users can read own notes" ON public.notes;
CREATE POLICY "Users can read own notes" ON public.notes
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own notes" ON public.notes;
CREATE POLICY "Users can insert own notes" ON public.notes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notes" ON public.notes;
CREATE POLICY "Users can update own notes" ON public.notes
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own notes" ON public.notes;
CREATE POLICY "Users can delete own notes" ON public.notes
  FOR DELETE USING (auth.uid() = user_id);

-- 7. High-Performance Indexes
CREATE INDEX IF NOT EXISTS idx_books_user_id ON public.books(user_id);
CREATE INDEX IF NOT EXISTS idx_books_updated_at ON public.books(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON public.notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_book_id ON public.notes(book_id);
