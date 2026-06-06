import { supabase } from "../lib/supabase";

export async function getDashboardData() {

  const { data: obras } = await supabase
    .from("obras")
    .select("*");

  return {
    totalObras: obras?.length || 0,
    obras: obras || []
  };
}