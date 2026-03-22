// ============================================================
//  SUPABASE CONFIG
//  1. Crea un proyecto en https://supabase.com (gratis)
//  2. Ve a Project Settings → API
//  3. Copia la "Project URL" y la "anon public" key aquí
// ============================================================

const SUPABASE_URL = 'https://aklieayhnjnhikmggpiv.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_09neP8LoEfPp96xCoxKEwA_X9gk5cxc';

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
