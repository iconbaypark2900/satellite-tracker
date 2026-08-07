/**
 * Landing page — redirects to the 3D globe view.
 */

import { redirect } from "next/navigation";

export default function HomePage() {
  redirect("/globe");
}

// Also export a loading state
export function generateMetadata() {
  return {
    title: "🛰️ Satellite Tracker",
    description: "Real-time 3D satellite tracking with SGP4 orbital mechanics.",
  };
}
