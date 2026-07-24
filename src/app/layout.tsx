import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CF AI Analyzer - Elevate your CP Rating",
  description: "AI-powered Codeforces analyzer that finds your weaknesses and suggests personalized problems.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <nav className="border-b bg-[#1e293b]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <span className="text-2xl font-bold text-white tracking-wider">
                  <span className="text-blue-400">CF</span> Analyzer
                </span>
              </div>
              <div className="flex items-center space-x-4">
                <a href="https://codeforces.com" target="_blank" className="text-gray-300 hover:text-white px-3 py-2 text-sm font-medium">Codeforces</a>
                <a href="https://github.com/almuzahidseyam/cf-ai-analyzer" target="_blank" className="bg-gray-700 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-600 transition">GitHub</a>
              </div>
            </div>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
