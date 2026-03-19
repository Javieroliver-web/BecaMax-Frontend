// ============================================================
//  SUPABASE CONFIG
//  1. Crea un proyecto en https://supabase.com (gratis)
//  2. Ve a Project Settings → API
//  3. Copia la "Project URL" y la "anon public" key aquí
// ============================================================

const SUPABASE_URL = 'https://TU_PROYECTO.supabase.co';
const SUPABASE_ANON_KEY = 'TU_ANON_KEY_AQUI';

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
