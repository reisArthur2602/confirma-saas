import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@confirma/ui/components/button';
import { Code } from './code';

export function HeroSection() {
    return (
        <section className="flex flex-1 items-center justify-center">
            <div className="mx-auto grid max-w-260 grid-cols-1 items-center gap-10 px-5 py-16 sm:px-7 md:grid-cols-[1.05fr_1fr] md:gap-13 md:py-16">
                <div className="min-w-0 text-left">
                    <div className="mb-5 inline-flex animate-[cfmFade_0.3s_ease] items-center gap-1.5 rounded-full border border-[#dbe6fd] bg-[#f5f8ff] px-3.5 py-1.5 text-[12px] font-semibold text-primary">
                        <span className="size-1.5 animate-[cfmPulse_1.8s_ease-in-out_infinite] rounded-full bg-primary" />
                        Vagas limitadas do acesso antecipado
                    </div>

                    <h1 className="mb-4 animate-[cfmFade_0.35s_ease] text-[32px] leading-[1.14] font-bold tracking-[-0.03em] text-balance sm:text-[42px]">
                        Confirmação de agenda que se integra em minutos, não semanas.
                    </h1>

                    <p className="mb-8 animate-[cfmFade_0.4s_ease] text-[16.5px] leading-[1.6] text-pretty text-secondary-foreground">
                        Conecte seu sistema e seu próprio WhatsApp ao Confirma e deixe a
                        gente cuidar de lembrar, confirmar e atualizar a agenda
                        automaticamente.
                    </p>

                    <Button asChild className="animate-[cfmFade_0.45s_ease] gap-2">
                        <Link href="#form">
                            Entrar na lista de espera
                            <ArrowRight className="size-4" strokeWidth={2.2} />
                        </Link>
                    </Button>
                    <div className="mt-2.5 text-sm text-muted-foreground">
                        Vagas limitadas para a primeira turma de acesso
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-4 text-[12px] text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                            <svg
                                width="13"
                                height="13"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="#178a45"
                                strokeWidth="2.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="M20 6L9 17l-5-5" />
                            </svg>
                            Sem compromisso, sem cartão
                        </span>
                        <span className="flex items-center gap-1.5">
                            <svg
                                width="13"
                                height="13"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="#178a45"
                                strokeWidth="2.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="M20 6L9 17l-5-5" />
                            </svg>
                            Só 2 minutos para se inscrever
                        </span>
                    </div>
                </div>

                <div className="min-w-0">
                    <Code />

                    <div className="mt-5 flex justify-center gap-6">
                        <div className="text-center">
                            <div className="text-xl font-bold tracking-[-0.02em]">75%</div>
                            <div className="text-[11px] text-muted-foreground">
                                menos faltas nos testes
                            </div>
                        </div>
                        <div className="w-px bg-border" />
                        <div className="text-center">
                            <div className="text-xl font-bold tracking-[-0.02em]">1</div>
                            <div className="text-[11px] text-muted-foreground">
                                chamada pra integrar
                            </div>
                        </div>
                        <div className="w-px bg-border" />
                        <div className="text-center">
                            <div className="text-xl font-bold tracking-[-0.02em]">
                                seu nº
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                                de WhatsApp, sempre
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
