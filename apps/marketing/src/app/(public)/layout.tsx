import { Header } from '../../components/header';

export default function PublicLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <div className="flex min-h-screen flex-col bg-background text-foreground">
            <Header />
            {children}
        </div>
    );
}
