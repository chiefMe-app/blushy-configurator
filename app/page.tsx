import { redirect } from "next/navigation";

// For now the home link opens the builder directly; the landing page lives at /landing.
export default function Home() {
  redirect("/configure");
}
