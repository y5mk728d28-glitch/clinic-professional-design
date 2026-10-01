// Cliente de Supabase (backend real). La "publishable key" es segura para
// usar en el navegador — está diseñada para eso y protegida por las
// políticas de seguridad (RLS) definidas en supabase/schema.sql.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://cgbigxovkplblmvkskza.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_uXl1VlaIsXgayF5VPbAiKA_8yU1inbz';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
