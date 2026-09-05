import "./globals.css";
import { UserProvider } from "@/context/UserContext";
import { AdminProvider } from "@/context/AdminContext";

export const metadata = {
  title: "🇬🇪 Wonder Georgia — Plan Together",
  description:
    "Collaborative trip planner for the country of Georgia. Shortlist regions, vote, rate and comment to build an itinerary your whole group agrees on.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <UserProvider>
          <AdminProvider>{children}</AdminProvider>
        </UserProvider>
      </body>
    </html>
  );
}
