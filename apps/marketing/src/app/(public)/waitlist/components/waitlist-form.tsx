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
import { Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const WAITLIST_API_URL = process.env.NEXT_PUBLIC_API_URL;

const clientsCountOptions: { value: NonNullable<WaitlistBody['clientsCount']>; label: string }[] = [
    { value: 'nenhuma', label: 'Nenhuma ainda (explorando)' },
    { value: '1', label: '1 cliente' },
    { value: '2-5', label: '2 a 5 clientes' },
    { value: '5+', label: 'Mais de 5 clientes' },
];

const interestOptions: { value: NonNullable<WaitlistBody['interest']>; label: string }[] = [
    { value: 'reduzir_faltas', label: 'Reduzir faltas dos meus clientes' },
    { value: 'nao_construir_fila', label: 'Não construir fila/retry/compliance do zero' },
    { value: 'byo', label: 'Usar minha própria instância WhatsApp' },
    { value: 'documentacao', label: 'Documentação e DX da API' },
    { value: 'outro', label: 'Outro' },
];

type FormState = {
    name: string;
    email: string;
    company: string;
    clientsCount: WaitlistBody['clientsCount'];
    system: string;
    interest: WaitlistBody['interest'];
    source: string;
};

const initialState: FormState = {
    name: '',
    email: '',
    company: '',
    clientsCount: undefined,
    system: '',
    interest: undefined,
    source: '',
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
        if (!form.clientsCount) return setError('Selecione quantas clínicas você atende.');
        if (!form.interest) return setError('Selecione o que mais te interessa.');

        const parsed = waitlistBody.safeParse({
            name: form.name.trim(),
            email: form.email.trim(),
            company: form.company.trim() || undefined,
            clientsCount: form.clientsCount,
            system: form.system.trim() || undefined,
            interest: form.interest,
            source: form.source.trim() || undefined,
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

                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="company">Empresa ou software house</Label>
                    <Input
                        id="company"
                        placeholder="Deixe em branco se for dev autônomo/freelancer"
                        value={form.company}
                        onChange={(e) => updateField('company', e.target.value)}
                    />
                </div>

                <div className="flex flex-col gap-2">
                    <Label>
                        Você desenvolve para quantas clínicas/consultórios atualmente?{' '}
                        <span className="text-destructive">*</span>
                    </Label>
                    <RadioGroup
                        value={form.clientsCount}
                        onValueChange={(value) =>
                            updateField('clientsCount', value as FormState['clientsCount'])
                        }
                    >
                        {clientsCountOptions.map((opt) => (
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

                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="system">
                        Qual sistema você já mantém ou pretende integrar?
                    </Label>
                    <Input
                        id="system"
                        placeholder="ex: ERP próprio, prontuário eletrônico, sistema de agenda"
                        value={form.system}
                        onChange={(e) => updateField('system', e.target.value)}
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

                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="source">Como você soube do Confirma?</Label>
                    <Input
                        id="source"
                        placeholder="ex: LinkedIn, indicação, comunidade"
                        value={form.source}
                        onChange={(e) => updateField('source', e.target.value)}
                    />
                </div>

                {error ? (
                    <div className="rounded-[7px] border border-[#f6cccc] bg-[#fdeeee] px-2.5 py-2 text-sm text-destructive">
                        {error}
                    </div>
                ) : null}

                <Button type="submit" size="secondary" className="mt-1" disabled={submitting}>
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
