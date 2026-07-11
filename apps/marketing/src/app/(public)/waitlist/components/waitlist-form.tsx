'use client';

import { waitlistBody, type WaitlistBody } from '@confirma/contracts';
import { Button } from '@confirma/ui/components/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@confirma/ui/components/dialog';
import { Input } from '@confirma/ui/components/input';
import { Label } from '@confirma/ui/components/label';
import { RadioGroup, RadioGroupItem } from '@confirma/ui/components/radio-group';
import { cn } from '@confirma/ui/lib/utils';
import { Check, Link2, MessageCircleQuestion, Users2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const WAITLIST_API_URL = process.env.NEXT_PUBLIC_API_URL;

const interestOptions: { value: NonNullable<WaitlistBody['interest']>; label: string }[] = [
    { value: 'reduzir_faltas', label: 'Reduzir faltas dos meus clientes' },
    { value: 'nao_construir_fila', label: 'Não construir fila/retry/compliance do zero' },
    { value: 'byo', label: 'Usar minha própria instância WhatsApp' },
    { value: 'documentacao', label: 'Documentação e DX da API' },
    { value: 'outro', label: 'Outro' },
];

const sourceOptions: {
    value: NonNullable<WaitlistBody['source']>;
    label: string;
    icon: typeof Link2;
}[] = [
    { value: 'linkedin', label: 'LinkedIn', icon: Link2 },
    { value: 'indicacao', label: 'Indicação', icon: Users2 },
    { value: 'comunidade', label: 'Comunidade', icon: MessageCircleQuestion },
    { value: 'outro', label: 'Outro', icon: MessageCircleQuestion },
];

type FormState = {
    name: string;
    email: string;
    interest: WaitlistBody['interest'];
    source: WaitlistBody['source'];
};

const initialState: FormState = {
    name: '',
    email: '',
    interest: undefined,
    source: undefined,
};

export function WaitlistForm() {
    const router = useRouter();
    const [form, setForm] = useState<FormState>(initialState);
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
        setForm((prev) => ({ ...prev, [key]: value }));
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        if (!form.name.trim()) return setError('Informe seu nome completo.');
        if (!form.email.trim() || !form.email.includes('@'))
            return setError('Informe um e-mail válido.');
        if (!form.interest) return setError('Selecione o que mais te interessa.');

        const parsed = waitlistBody.safeParse({
            name: form.name.trim(),
            email: form.email.trim(),
            interest: form.interest,
            source: form.source,
        });

        if (!parsed.success) {
            return setError('Verifique os dados informados e tente novamente.');
        }

        if (!WAITLIST_API_URL) {
            return setError('Configuração ausente: NEXT_PUBLIC_API_URL não definida.');
        }

        setError('');
        setSubmitting(true);

        try {
            const res = await fetch(`${WAITLIST_API_URL}/waitlist`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(parsed.data),
            });

            if (!res.ok) {
                throw new Error(`Request failed with status ${res.status}`);
            }

            setSubmitted(true);
        } catch {
            setError('Não foi possível enviar sua inscrição. Tente novamente em instantes.');
        } finally {
            setSubmitting(false);
        }
    }

    function handleDialogChange(open: boolean) {
        if (!open) {
            router.push('/');
        }
    }

    return (
        <>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="name">
                        Nome completo <span className="text-destructive">*</span>
                    </Label>
                    <Input
                        id="name"
                        placeholder="Seu nome"
                        value={form.name}
                        onChange={(e) => updateField('name', e.target.value)}
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="email">
                        E-mail <span className="text-destructive">*</span>
                    </Label>
                    <Input
                        id="email"
                        type="email"
                        placeholder="voce@empresa.com"
                        value={form.email}
                        onChange={(e) => updateField('email', e.target.value)}
                    />
                </div>

                <div className="flex flex-col gap-2">
                    <Label>
                        O que mais te interessa no Confirma?{' '}
                        <span className="text-destructive">*</span>
                    </Label>
                    <RadioGroup
                        value={form.interest}
                        onValueChange={(value) =>
                            updateField('interest', value as FormState['interest'])
                        }
                    >
                        {interestOptions.map((opt) => (
                            <label
                                key={opt.value}
                                className="flex items-center gap-2 text-base text-foreground"
                            >
                                <RadioGroupItem value={opt.value} />
                                {opt.label}
                            </label>
                        ))}
                    </RadioGroup>
                </div>

                <div className="flex flex-col gap-2">
                    <Label>Como você soube do Confirma?</Label>
                    <div className="grid grid-cols-2 gap-2.5">
                        {sourceOptions.map((opt) => {
                            const Icon = opt.icon;
                            const selected = form.source === opt.value;
                            return (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => updateField('source', opt.value)}
                                    aria-pressed={selected}
                                    className={cn(
                                        'flex flex-col items-center gap-1.5 rounded-[9px] border px-3 py-3.5 text-sm font-medium transition-colors',
                                        selected
                                            ? 'border-primary bg-accent text-accent-foreground'
                                            : 'border-input text-secondary-foreground hover:bg-accent/50',
                                    )}
                                >
                                    <Icon className="size-4.5" strokeWidth={1.9} />
                                    {opt.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {error ? (
                    <div className="rounded-[7px] border border-[#f6cccc] bg-[#fdeeee] px-2.5 py-2 text-sm text-destructive">
                        {error}
                    </div>
                ) : null}

                <Button
                    type="submit"
                    size="secondary"
                    className="mt-1 w-full"
                    disabled={submitting}
                >
                    {submitting ? 'Enviando…' : 'Garantir acesso antecipado'}
                </Button>
            </form>

            <Dialog open={submitted} onOpenChange={handleDialogChange}>
                <DialogContent className="text-center sm:text-center">
                    <DialogHeader>
                        <div className="mx-auto mb-1.5 flex size-10 items-center justify-center rounded-full bg-[#e7f5ec]">
                            <Check className="size-6 text-success" strokeWidth={2.6} />
                        </div>
                        <DialogTitle className="text-xl">Prontinho!</DialogTitle>
                        <DialogDescription className="text-base">
                            Você garantiu acesso antecipado ao Confirma. Em breve enviaremos a
                            documentação da API
                        </DialogDescription>
                    </DialogHeader>
                </DialogContent>
            </Dialog>
        </>
    );
}
