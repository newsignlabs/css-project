import type { ReactNode } from "react";
import "./newbrush.css";

export const metadata = { title: "newBrush + Next.js" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
