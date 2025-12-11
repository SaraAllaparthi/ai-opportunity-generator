-- Migration: Add deleted_at to briefs for soft delete support
ALTER TABLE public.briefs 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Index for filtering deleted items
CREATE INDEX IF NOT EXISTS idx_briefs_deleted_at ON public.briefs(deleted_at);
