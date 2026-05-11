import os
import pandas as pd
from supabase import create_client
from dotenv import load_dotenv

# Use abspath so the path resolves correctly regardless of where Python was launched from
_this_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(_this_dir, "..", ".env.local"), override=True)

supabase = create_client(
    os.environ["NEXT_PUBLIC_SUPABASE_URL"],
    os.environ["SUPABASE_SERVICE_ROLE_KEY"],  # service role bypasses RLS
)


def load_expenses(user_id: str) -> pd.DataFrame:
    """Load all expenses for a user into a pandas DataFrame."""
    response = (
        supabase.table("expenses")
        .select("*")
        .eq("user_id", user_id)
        .order("date")
        .execute()
    )

    df = pd.DataFrame(response.data)
    if df.empty:
        return df

    df["date"] = pd.to_datetime(df["date"])
    df["amount"] = df["amount"].astype(float)
    df["month"] = df["date"].dt.to_period("M")
    return df


def load_monthly_summary(user_id: str) -> pd.DataFrame:
    """Load monthly_summary table into a pandas DataFrame."""
    response = (
        supabase.table("monthly_summary")
        .select("*")
        .eq("user_id", user_id)
        .order("year,month")
        .execute()
    )

    return pd.DataFrame(response.data)
