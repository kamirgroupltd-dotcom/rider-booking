import type { Metadata } from "next";
import AdminClient from "./AdminClient";

export const metadata: Metadata = {
  title: "Admin",
  description: "Internal admin console.",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <AdminClient />;
}
