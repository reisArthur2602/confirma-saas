# Confirma

**Confirma** é uma infraestrutura de confirmação de agenda para clínicas e sistemas de saúde. Sistemas externos (ERP, prontuário, RIS, agenda) chamam um webhook público para delegar ao Confirma o envio do lembrete via WhatsApp, a interpretação da resposta do paciente (confirmar / cancelar / remarcar) e o callback de volta ao sistema de origem, mantendo a agenda sincronizada automaticamente.

O produto se posiciona como redutor de **no-show**, não como notificador genérico.

**Modelo de canal — BYO-Instance:** o Confirma não é reseller de mensageria. O cliente traz sua própria instância Evolution API (URL + token) e cadastra as credenciais no painel; o Confirma orquestra fila, timing, interpretação de resposta e sincronização, sem custo nem risco de mensageria.

**Público-alvo:** software houses e desenvolvedores que constroem sistemas para clínicas e querem confirmação automática sem construir fila, retry, gestão de templates e compliance LGPD.

> Documentação completa de produto e arquitetura em [`docs/context/PRD.md`](docs/context/PRD.md) e [`docs/context/TECH_SPECS.md`](docs/context/TECH_SPECS.md).

---

## Arquitetura

Monorepo **pnpm workspaces + Turborepo**, composto por 3 apps e 2 packages compartilhados:

| App                | Package            | Stack                       | Público                | Propósito                                                       |
| ------------------ | ------------------- | ---------------------------- | ----------------------- | ----------------------------------------------------------------- |
| `apps/api`         | `@confirma/api`     | Fastify + Prisma + BullMQ    | Dev integrador          | Núcleo do produto: ingestão, workers, auth, webhooks, métricas   |
| `apps/painel`      | `@confirma/app`     | TanStack Router + Vite (SPA) | Gestor da clínica / dev | Painel autenticado: métricas, API keys, config BYO               |
| `apps/marketing`   | `@confirma/marketing` | Next.js                    | Visitante / dev         | Landing page + documentação técnica pública + lista de espera    |

| Package               | Conteúdo                                                           |
| --------------------- | -------------------------------------------------------------------- |
| `packages/contracts`  | Schemas Zod + tipos compartilhados (ingestão, callback, waitlist)  |
| `packages/config`     | `tsconfig` e ESLint config compartilhados (`@confirma/config`)     |

**Stack principal:** Node.js 22 + TypeScript, Fastify, Prisma, PostgreSQL 15, Redis 7 (BullMQ), Better Auth (Google OAuth + Magic Link), Resend (e-mail transacional), Evolution API (canal WhatsApp BYO).

**Agendamento em duas camadas:** todo lembrete nasce como `NotificationJob` em `PENDING` no Postgres (camada fria); um cron de promoção materializa no BullMQ (`ENQUEUED`) só quando entra na janela de curto prazo (ex.: 24h antes do disparo). Isso evita acumular jobs de longuíssimo prazo no Redis e torna cancelamentos triviais antes da promoção.

**Deploy:** `api` e `painel` rodam em VPS via PM2 + GitHub Actions (SSH), com Postgres e Redis instalados nativamente (sem Docker); `marketing` é publicado na Vercel com deploy nativo por push, isolando o blast radius do produto autenticado das páginas públicas.

---

## Desenvolvimento

Pré-requisitos: Node.js 22, pnpm, PostgreSQL e Redis instalados localmente.

```sh
pnpm install
```

Rodar todos os apps em modo dev:

```sh
pnpm turbo dev
```

Rodar um app específico (ex.: só a API):

```sh
pnpm turbo dev --filter=api
```

Build de todos os apps/packages:

```sh
pnpm turbo build
```

Lint e testes:

```sh
pnpm turbo lint
pnpm turbo test
```

---

## Estrutura do repositório

```
confirma/
├── apps/
│   ├── api/          # Fastify — API, workers, crons, auth
│   ├── painel/        # TanStack Router SPA — painel autenticado
│   └── marketing/     # Next.js — landing + docs públicas + waitlist
├── packages/
│   ├── contracts/        # Schemas Zod compartilhados (webhook, callback, waitlist)
│   └── config/           # tsconfig e eslint-config compartilhados
└── docs/
    └── context/
        ├── PRD.md         # Requisitos de produto
        └── TECH_SPECS.md  # Especificação técnica e arquitetura
```

## Contexto de produto

Para entender requisitos funcionais, contrato de API, máquina de estados do agendamento, modelo de dados e modelo de negócio, ver [`docs/context/PRD.md`](docs/context/PRD.md).

Para detalhes de implementação (schema Prisma, autenticação, adapter BYO da Evolution API, agendamento em duas camadas, segurança e deploy), ver [`docs/context/TECH_SPECS.md`](docs/context/TECH_SPECS.md).
