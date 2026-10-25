// Supabase Cloud Database & Auth Service for ReaWid
// Enables cross-device sync (mobile, tablet, desktop) and zero-mock cloud persistence

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: window.localStorage
      }
    })
  : null;

// Reactive auth state listener
let currentUser = null;
const authListeners = new Set();

if (supabase) {
  // Get initial session
  supabase.auth.getSession().then(({ data: { session } }) => {
    currentUser = session?.user || null;
    notifyAuthListeners();
  }).catch(err => {
    console.warn('Supabase getSession error:', err);
  });

  // Subscribe to auth state changes
  supabase.auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user || null;
    notifyAuthListeners();
  });
}

function notifyAuthListeners() {
  authListeners.forEach(listener => {
    try {
      listener(currentUser);
    } catch (err) {
      console.error('Auth listener error:', err);
    }
  });
}

export function subscribeAuth(listener) {
  authListeners.add(listener);
  // Immediately call with current user
  listener(currentUser);
  return () => authListeners.delete(listener);
}

export function getCurrentUser() {
  return currentUser;
}

/* ==========================================================================
   Supabase Authentication (Sign In, Sign Up, Sign Out)
   ========================================================================== */

export async function signUpWithEmail(email, password) {
  if (!supabase) return { error: { message: 'Supabase yapılandırılmamış.' } };
  try {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password
    });
    if (error) throw error;
    currentUser = data.user || null;
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

export async function signInWithEmail(email, password) {
  if (!supabase) return { error: { message: 'Supabase yapılandırılmamış.' } };
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password
    });
    if (error) throw error;
    currentUser = data.user || null;
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

export async function signOutUser() {
  if (!supabase) return { error: null };
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    currentUser = null;
    return { error: null };
  } catch (error) {
    return { error };
  }
}

/* ==========================================================================
   Cloud Sync Engine (Local-First + Background Supabase Sync)
   ========================================================================== */

// Helper to format book object for Supabase PostgreSQL schema
function bookToDbRow(book, userId) {
  return {
    id: book.id,
    user_id: userId,
    title: book.title || 'Başlıksız Kitap',
    author: book.author || '',
    cover: book.cover || '',
    total_pages: Number(book.totalPages) || 1,
    current_page: Number(book.currentPage) || 1,
    progress: Math.min(100, Math.max(0, Number(book.progress) || 0)),
    is_current: Boolean(book.isCurrent),
    chapter: book.chapter || '',
    chapter_subtitle: book.chapterSubtitle || '',
    status: book.status || 'okunanlar',
    content: book.content || '',
    real_page_image: book.realPageImage || '',
    page_paragraphs: {
      ...(book.pageParagraphs || {}),
      __meta: {
        pdfFingerprint: book.pdfFingerprint || '',
        fileSize: book.fileSize || 0
      }
    },
    updated_at: new Date().toISOString()
  };
}

// Helper to convert database row back into Reawid Book object
function dbRowToBook(row) {
  const paragraphs = row.page_paragraphs || {};
  const meta = paragraphs.__meta || {};
  const cleanParagraphs = { ...paragraphs };
  delete cleanParagraphs.__meta;

  return {
    id: row.id,
    title: row.title || 'Başlıksız Kitap',
    author: row.author || '',
    cover: row.cover || '/cover-1.jpg',
    totalPages: Number(row.total_pages) || 1,
    currentPage: Number(row.current_page) || 1,
    progress: Number(row.progress) || 0,
    isCurrent: Boolean(row.is_current),
    chapter: row.chapter || '',
    chapterSubtitle: row.chapter_subtitle || '',
    status: row.status || 'okunanlar',
    content: row.content || '',
    realPageImage: row.real_page_image || '',
    pageParagraphs: cleanParagraphs,
    pdfFingerprint: meta.pdfFingerprint || '',
    fileSize: meta.fileSize || 0,
    date: row.updated_at ? new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(row.updated_at)) : 'Bugün',
    updatedAt: row.updated_at
  };
}

// Helper to format note object for Supabase PostgreSQL schema
function noteToDbRow(note, userId) {
  return {
    id: note.id,
    user_id: userId,
    book_id: note.bookId || '',
    book_title: note.bookTitle || '',
    book_author: note.bookAuthor || '',
    page_number: Number(note.pageNumber) || 1,
    type: note.type || 'quote',
    text: note.text || '',
    user_note: note.userNote || '',
    date_formatted: note.dateFormatted || '',
    created_at: note.createdAt ? new Date(note.createdAt).toISOString() : new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

// Helper to convert database row back into Reawid Note object
function dbRowToNote(row) {
  return {
    id: row.id,
    bookId: row.book_id || '',
    bookTitle: row.book_title || '',
    bookAuthor: row.book_author || '',
    pageNumber: Number(row.page_number) || 1,
    type: row.type || 'quote',
    text: row.text || '',
    userNote: row.user_note || '',
    dateFormatted: row.date_formatted || '',
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now()
  };
}

/**
 * Full Bi-Directional Sync:
 * Merges local books & notes with Supabase cloud books & notes.
 * Ideal on login, app start, and manual "Şimdi Eşitle" button click.
 */
export async function syncAllWithCloud(localBooks = [], localNotes = []) {
  if (!supabase || !currentUser) {
    return { synced: false, reason: 'unauthenticated', books: localBooks, notes: localNotes };
  }

  try {
    const userId = currentUser.id;

    // 1. Fetch remote books
    const { data: remoteBooksData, error: booksError } = await supabase
      .from('books')
      .select('*')
      .eq('user_id', userId);

    if (booksError) throw booksError;

    // 2. Fetch remote notes
    const { data: remoteNotesData, error: notesError } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', userId);

    if (notesError) throw notesError;

    const remoteBooks = (remoteBooksData || []).map(dbRowToBook);
    const remoteNotes = (remoteNotesData || []).map(dbRowToNote);

    // 3. Merge Books (Local + Remote)
    const booksMap = new Map();
    // Start with remote books
    remoteBooks.forEach(b => booksMap.set(b.id, b));
    // Overlay local books (if local is newer or has higher progress)
    localBooks.forEach(local => {
      if (!booksMap.has(local.id)) {
        booksMap.set(local.id, local);
      } else {
        const existing = booksMap.get(local.id);
        // Keep the one with higher progress or local edits
        const localProgress = local.progress || 0;
        const remoteProgress = existing.progress || 0;
        if (localProgress >= remoteProgress) {
          booksMap.set(local.id, { ...existing, ...local });
        }
      }
    });

    const mergedBooks = Array.from(booksMap.values());

    // 4. Merge Notes
    const notesMap = new Map();
    remoteNotes.forEach(n => notesMap.set(n.id, n));
    localNotes.forEach(local => {
      notesMap.set(local.id, local);
    });
    const mergedNotes = Array.from(notesMap.values());

    // 5. Upsert merged books & notes to Supabase so cloud is 100% in sync
    if (mergedBooks.length > 0) {
      const dbBooks = mergedBooks.map(b => bookToDbRow(b, userId));
      await supabase.from('books').upsert(dbBooks, { onConflict: 'id' });
    }

    if (mergedNotes.length > 0) {
      const dbNotes = mergedNotes.map(n => noteToDbRow(n, userId));
      await supabase.from('notes').upsert(dbNotes, { onConflict: 'id' });
    }

    return {
      synced: true,
      books: mergedBooks,
      notes: mergedNotes,
      error: null
    };
  } catch (error) {
    console.warn('Sync with cloud failed:', error);
    return { synced: false, reason: error.message, books: localBooks, notes: localNotes, error };
  }
}

/**
 * Background single-book upsert (non-blocking)
 */
export async function syncBookToCloud(book) {
  if (!supabase || !currentUser || !book || !book.id) return;
  try {
    const row = bookToDbRow(book, currentUser.id);
    await supabase.from('books').upsert(row, { onConflict: 'id' });
  } catch (err) {
    console.warn('Background syncBookToCloud error:', err);
  }
}

/**
 * Background book delete (non-blocking)
 */
export async function deleteBookFromCloud(bookId) {
  if (!supabase || !currentUser || !bookId) return;
  try {
    await supabase.from('books').delete().eq('id', bookId).eq('user_id', currentUser.id);
  } catch (err) {
    console.warn('Background deleteBookFromCloud error:', err);
  }
}

/**
 * Background single-note upsert (non-blocking)
 */
export async function syncNoteToCloud(note) {
  if (!supabase || !currentUser || !note || !note.id) return;
  try {
    const row = noteToDbRow(note, currentUser.id);
    await supabase.from('notes').upsert(row, { onConflict: 'id' });
  } catch (err) {
    console.warn('Background syncNoteToCloud error:', err);
  }
}

/**
 * Background note delete (non-blocking)
 */
export async function deleteNoteFromCloud(noteId) {
  if (!supabase || !currentUser || !noteId) return;
  try {
    await supabase.from('notes').delete().eq('id', noteId).eq('user_id', currentUser.id);
  } catch (err) {
    console.warn('Background deleteNoteFromCloud error:', err);
  }
}
