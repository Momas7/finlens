import type { Metadata } from 'next';
import { Archivo } from 'next/font/google';
import { themeScript } from '@/lib/theme';
import './globals.css';

const archivo = Archivo({
  variable: '--font-archivo',
  subsets: ['latin'],
  axes: ['wdth'],
});

export const metadata: Metadata = {
  title: 'Finlens',
  description:
    'Analista financeiro pessoal open source: importa extratos, classifica e mostra para onde vai seu dinheiro.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="pt-BR"
      className={`${archivo.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: script estático de tema, sem dados do usuário */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
