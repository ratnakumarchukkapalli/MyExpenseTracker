import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import { fetchBootstrapData } from "@/lib/bootstrap-data";

export default async function Home() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const initialData = await fetchBootstrapData(supabase, user, month, year);

  return <AppShell initialData={initialData} serverMonth={month} serverYear={year} />;
}
