import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://lkrznqpbvsfwrkpgshfr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_b3T_UXe0c6n5NTCbibDAOw_yWa9nRiL";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);