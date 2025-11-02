import { createClient } from "@supabase/supabase-js";

console.log("url", import.meta.env.VITE_SUPABASE_URL!);

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_KEY!,
  {
    auth: {
      persistSession: true,
    }
  }
);
export default supabase;