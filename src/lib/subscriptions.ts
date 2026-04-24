import { SupabaseClient } from "@supabase/supabase-js";

export function advanceRenewalDate(renewalDate: string, billingType: string): string {
  const d = new Date(renewalDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (billingType === "monthly") {
    while (d < today) d.setMonth(d.getMonth() + 1);
  } else {
    while (d < today) d.setFullYear(d.getFullYear() + 1);
  }
  
  return d.toISOString().split("T")[0];
}

export async function autoAdvanceSubscriptions(supabase: SupabaseClient, userId: string, subscriptions: any[]) {
  const toUpdate: { id: number; advanced: string }[] = [];
  
  const updated = subscriptions.map((sub) => {
    if (
      sub.renewal_date &&
      sub.status === "active"
    ) {
      const advanced = advanceRenewalDate(sub.renewal_date, sub.billing_type);
      if (advanced !== sub.renewal_date) {
        toUpdate.push({ id: sub.id, advanced });
        return { ...sub, renewal_date: advanced };
      }
    }
    return sub;
  });

  if (toUpdate.length > 0) {
    // Perform updates in parallel
    await Promise.all(
      toUpdate.map(({ id, advanced }) =>
        supabase
          .from("subscriptions")
          .update({ renewal_date: advanced })
          .eq("id", id)
          .eq("user_id", userId)
      )
    );
  }

  return updated;
}
