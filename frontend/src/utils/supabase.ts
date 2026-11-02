import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://jcbliweaziuzjclhqogv.supabase.co';
const DEFAULT_SUPABASE_KEY = 'sb_publishable_SxOEnVNAPw3q1FjlBKIWvw_IKxqBIsE';

const url = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const key =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  DEFAULT_SUPABASE_KEY;

export const supabase = url && key ? createClient(url, key) : null;
