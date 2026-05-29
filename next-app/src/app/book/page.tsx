import type { Metadata } from "next";
import BookingClient from "./BookingClient";

export const metadata: Metadata = {
  title: "Book shifts",
  description: "Courier shift booking — pick a date, pick a shift, confirm.",
  robots: { index: false, follow: false },
};

export default function BookPage() {
  return <BookingClient />;
}
