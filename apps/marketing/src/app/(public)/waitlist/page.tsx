import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { WaitlistForm } from './components/waitlist-form';

const Waitlist = () => {
    return (
        <section className="flex flex-1 justify-center px-5 py-12 sm:px-7">
            <div className="w-full max-w-140">
                <Link
                    href="/"
                    className="mb-5.5 flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"
                >
                    <ArrowLeft className="size-3.75" strokeWidth={2.4} />
                    Voltar
                </Link>

                <h1 className="mb-1.5 text-3xl font-bold tracking-[-0.02em]">
                    Entrar na lista de espera
                </h1>
                <p className="mb-7 text-base text-muted-foreground">
                    2 minutos, sem compromisso.
                </p>

                <WaitlistForm />
            </div>
        </section>
    );
};

export default Waitlist;
