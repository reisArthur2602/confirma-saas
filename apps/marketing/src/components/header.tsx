import { Check } from 'lucide-react';

export function Header() {
    return (
        <header className="border-b border-border">
            <div className="mx-auto flex max-w-260 items-center px-5 py-4.5 sm:px-7">
                <div className="flex items-center gap-2.5">
                    <div className="flex size-6.5 shrink-0 items-center justify-center rounded-[7px] bg-primary shadow-[0_1px_3px_rgba(47,107,243,0.35)]">
                        <Check className="size-3.75 text-white" strokeWidth={3} />
                    </div>
                    <span className="text-[16.5px] font-bold tracking-[-0.02em] text-foreground">
                        Confirma
                    </span>
                </div>
            </div>
        </header>
    );
}
