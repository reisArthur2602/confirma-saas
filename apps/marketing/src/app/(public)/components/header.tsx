export function Header() {
    return (
        <header className="border-b border-border">
            <div className="mx-auto flex max-w-260 items-center px-5 py-4.5 sm:px-7">
                <div className="flex items-center gap-2.5">
                    <div className="flex size-6.5 shrink-0 items-center justify-center rounded-[7px] bg-primary shadow-[0_1px_3px_rgba(47,107,243,0.35)]">
                        <svg
                            width="15"
                            height="15"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#fff"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M20 6L9 17l-5-5" />
                        </svg>
                    </div>
                    <span className="text-[16.5px] font-bold tracking-[-0.02em] text-foreground">
                        Confirma
                    </span>
                </div>
            </div>
        </header>
    );
}
