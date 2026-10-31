import { redirect } from "next/navigation";
import { CubeMark, TowerLoader } from "@/components/TowerLoader";
import { AuthCard } from "@/components/AuthCard";
import { ThemeToggle } from "@/components/ThemeToggle";
import { getSession } from "@/lib/session";
import { api } from "@/lib/api";
import { listHospitals } from "@/lib/store";

export default async function Landing() {
  if (await getSession()) redirect("/dashboard");
  let hospitals: any[] = [];
  try {
    hospitals = await api.getHospitals();
  } catch {
    hospitals = listHospitals();
  }

  return (
    <main className="landing">
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: -10 }}>
        <div className="brand" style={{ fontSize: "var(--fs-lg)", fontWeight: 700, display: "flex", alignItems: "center", gap: 10 }}>
          <CubeMark size={28} /> AarogyaLink
        </div>
        <ThemeToggle />
      </header>

      <section className="band hero" aria-labelledby="hero-title">
        <div>
          <h1 id="hero-title">One patient. Every hospital. Only with consent.</h1>
          <p>
            A single, standardised health record that follows the patient across Apollo, Fortis and AIIMS. Doctors see
            a history only after the patient allows it, and every access is written to an audit log.
          </p>
        </div>
        <div className="hero-loader">
          <TowerLoader scale={2.2} label="AarogyaLink" />
        </div>
      </section>

      <section aria-label="Authentication">
        <AuthCard hospitals={hospitals} />
      </section>
    </main>
  );
}
