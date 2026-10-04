import type { Metadata, Viewport } from "next";
import { Montserrat, Playfair_Display } from "next/font/google";
import { BloomBackdrop } from "@/components/geo";
import { Header } from "@/components/header";
import { Notifier } from "@/components/notifier";
import { TodayProvider } from "@/components/today-provider";
import "./globals.css";

const display = Playfair_Display({ variable: "--font-display", subsets: ["latin"], weight: ["500", "600", "700"], style: ["normal", "italic"] });
const body = Montserrat({ variable: "--font-body", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "iKare — show up for the people you love",
  description: "Never miss the moments that matter to the people you love.",
  applicationName: "iKare",
  appleWebApp: { capable: true, title: "iKare", statusBarStyle: "default" },
  icons: {
    icon: [{ url: "/icons/favicon-32.png", sizes: "32x32" }, { url: "/icons/icon-any-192.png", sizes: "192x192" }],
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f1e7" },
    { media: "(prefers-color-scheme: dark)", color: "#171812" },
  ],
};

// Apply the saved theme before first paint to avoid a flash.
const themeScript = `try{var t=localStorage.getItem("icare.theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full font-sans">
        <BloomBackdrop />
        <TodayProvider>
          <Header />
          <Notifier />
          <main className="mx-auto w-full max-w-2xl px-4 pb-24 pt-8 lg:pb-16">{children}</main>
        </TodayProvider>
      </body>
    </html>
  );
}
