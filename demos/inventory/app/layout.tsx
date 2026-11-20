import type { Metadata } from "next";
import { Archivo, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/Nav";

// Archivo is a grotesk drawn for signage and industrial use: narrow apertures,
// flat terminals, and a heavy weight that still reads at a glance across a
// workshop. JetBrains Mono carries item numbers only — those are codes that get
// read a character at a time and compared against a printed label, where 0/O
// and 1/l have to be unmistakable.
const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-code",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Concord Inventory — demo",
  description:
    "A demo of the Concord Concrete Pumps inventory tracker, running on made-up data.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`h-full antialiased ${archivo.variable} ${jetbrainsMono.variable}`}
    >
      <body className="flex min-h-full flex-col bg-steel-100 text-steel-900 dark:bg-steel-950 dark:text-steel-100">
        <Nav />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
