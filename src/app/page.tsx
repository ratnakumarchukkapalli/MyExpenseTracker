import { Suspense } from "react";
import Loading from "./loading";
import DashboardLoader from "./DashboardLoader";

export default function Home() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  return (
    <Suspense fallback={<Loading />}>
      <DashboardLoader month={month} year={year} />
    </Suspense>
  );
}
