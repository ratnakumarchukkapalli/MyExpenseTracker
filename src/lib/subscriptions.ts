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

// Pure computation — no DB calls. Returns updated subscriptions and which rows need persisting.
export function advanceSubscriptionsLocally(subscriptions: any[]): {
  subscriptions: any[];
  toUpdate: { id: number; advanced: string }[];
} {
  const toUpdate: { id: number; advanced: string }[] = [];

  const updated = subscriptions.map((sub) => {
    if (sub.renewal_date && sub.status === "active") {
      const advanced = advanceRenewalDate(sub.renewal_date, sub.billing_type);
      if (advanced !== sub.renewal_date) {
        toUpdate.push({ id: sub.id, advanced });
        return { ...sub, renewal_date: advanced };
      }
    }
    return sub;
  });

  return { subscriptions: updated, toUpdate };
}

// DB persistence — call via after() so it doesn't block the response.
export async function persistSubscriptionAdvances(
  supabase: SupabaseClient,
  userId: string,
  toUpdate: { id: number; advanced: string }[]
) {
  if (toUpdate.length === 0) return;
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

// Legacy: kept for any callers outside bootstrap (subscription list page etc.)
export async function autoAdvanceSubscriptions(supabase: SupabaseClient, userId: string, subscriptions: any[]) {
  const { subscriptions: updated, toUpdate } = advanceSubscriptionsLocally(subscriptions);
  await persistSubscriptionAdvances(supabase, userId, toUpdate);
  return updated;
}
