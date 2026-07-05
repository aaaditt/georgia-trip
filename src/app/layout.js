import "./globals.css";
import { UserProvider } from "@/context/UserContext";

export const metadata = {
  title: "🇬🇪 Georgia Trip 2026 — Plan Together",
  description:
    "Collaborative trip planner for our Georgia adventure. Vote, rate, and comment on experiences to build the perfect itinerary.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <UserProvider>{children}</UserProvider>
      </body>
    </html>
  );
}
