'use client';

import { getBrowserClient } from '../supabase/browser';
import { getCurrentUserId } from './api';

const AUDIO_BUCKET = 'audio';

/** Upload an audio Blob to Supabase Storage and return its public URL. */
export async function uploadAudioClip(
  blob: Blob,
  { extension = 'wav' }: { extension?: string } = {},
): Promise<string> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Sign in to upload audio.');
  const supabase = getBrowserClient();

  const path = `${userId}/${Date.now()}-${randomSuffix()}.${extension}`;
  const { error } = await supabase.storage
    .from(AUDIO_BUCKET)
    .upload(path, blob, {
      contentType: blob.type || 'audio/wav',
      upsert: false,
    });
  if (error) throw error;

  const { data } = supabase.storage.from(AUDIO_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

function randomSuffix() {
  return Math.random().toString(36).slice(2, 10);
}
