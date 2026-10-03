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

export const viewport: Viewport = { themeColor: "#fff8f0" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        <TodayProvider>
          <Header />
          <main className="mx-auto w-full max-w-2xl px-4 pb-24 pt-6">{children}</main>
        </TodayProvider>
      </body>
    </html>
  );
}
