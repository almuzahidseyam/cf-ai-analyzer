import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata:Metadata={title:'CF Analyzer — practice notes',description:'A private Codeforces practice assistant using recent submission evidence and verified problem links.'};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>) {
  return <html lang="en"><body><nav aria-label="Main navigation"><Link className="brand" href="/">CF Analyzer</Link><div><a href="https://codeforces.com" target="_blank" rel="noopener noreferrer">Codeforces</a><a href="https://github.com/almuzahidseyam/cf-ai-analyzer" target="_blank" rel="noopener noreferrer">Source</a></div></nav>{children}</body></html>;
}
