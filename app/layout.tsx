import type { Metadata, Viewport } from "next";
import { Fraunces, Nunito } from "next/font/google";
import { Header } from "@/components/header";
import { TodayProvider } from "@/components/today-provider";
import "./globals.css";

const display = Fraunces({ variable: "--font-display", subsets: ["latin"], weight: ["600", "700"] });
const body = Nunito({ variable: "--font-body", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "iCare — show up for the people you love",
  description: "Never miss the moments that matter to the people you love.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fff8f0" },
    { media: "(prefers-color-scheme: dark)", color: "#15110d" },
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
        <TodayProvider>
          <Header />
          <main className="mx-auto w-full max-w-2xl px-4 pb-24 pt-6">{children}</main>
        </TodayProvider>
      </body>
    </html>
  );
}
