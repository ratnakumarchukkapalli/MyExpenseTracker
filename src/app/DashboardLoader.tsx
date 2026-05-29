import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import { fetchBootstrapData } from "@/lib/bootstrap-data";

export default async function DashboardLoader({
  month,
  year,
}: {
  month: number;
  year: number;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const initialData = await fetchBootstrapData(supabase, user, month, year);
  return <AppShell initialData={initialData} serverMonth={month} serverYear={year} />;
}
