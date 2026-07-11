import type { Metadata } from 'next';
import { IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

const ibmPlexSans = IBM_Plex_Sans({
    variable: '--font-ibm-plex-sans',
    subsets: ['latin'],
    weight: ['400', '500', '600', '700'],
});

const ibmPlexMono = IBM_Plex_Mono({
    variable: '--font-ibm-plex-mono',
    subsets: ['latin'],
    weight: ['400', '500', '600'],
});

export const metadata: Metadata = {
    title: {
        default: 'Confirma — Confirmação de agenda para clínicas via WhatsApp',
        template: '%s | Confirma',
    },
    description:
        'Confirma é a infraestrutura de confirmação de agenda: envie lembretes por WhatsApp, receba a resposta do paciente e sincronize automaticamente com o seu sistema via webhook.',
    keywords: [
        'confirmação de agenda',
        'no-show',
        'WhatsApp para clínicas',
        'confirmação de consulta',
        'webhook de agendamento',
    ],
    openGraph: {
        title: 'Confirma — Confirmação de agenda para clínicas via WhatsApp',
        description:
            'Reduza faltas na agenda: confirmação automática de consultas via WhatsApp, com sincronização por webhook.',
        locale: 'pt_BR',
        type: 'website',
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html
            lang="pt-BR"
            className={`${ibmPlexSans.variable} ${ibmPlexMono.variable} h-full antialiased`}
        >
            <body className="min-h-full flex flex-col">{children}</body>
        </html>
    );
}
