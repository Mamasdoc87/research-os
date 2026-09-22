import "./globals.css";
import { Providers } from "./providers";

export const metadata = {
  title: "Research OS",
  description: "Capture an idea. Check the literature. Don't lose the thread.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
