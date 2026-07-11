# TECH SPECS — Confirma (SaaS de Confirmação de Agenda)

> **Documento:** Especificação Técnica
> **Projeto:** Confirma *(nome provisório)*
> **Autor:** Arthur
> **Status:** Draft v0.5
> **Referência:** ver `PRD.md`
> **Última atualização:** 2026-07-11
>
> **Changelog v0.5:**
> - Nomes de pastas dos apps atualizados: `apps/dashboard` → `apps/painel`, `apps/marketing-docs` → `apps/marketing`. App `apps/blog` removido do escopo do monorepo (não haverá blog no MVP nem em fases futuras definidas).
>
> **Changelog v0.4:**
> - Provedor de e-mail transacional definido: **Resend** (substitui SMTP genérico), usado tanto para o Magic Link do Better Auth quanto para o e-mail de confirmação da lista de espera. Nodemailer sai do stack — o SDK oficial do Resend cobre os dois casos.
> - Lista de espera: formulário **nativo** em `apps/marketing-docs` (Tally descartado) chamando `POST /v1/waitlist` na própria API, com CORS liberado para o domínio da landing, rate limit por IP e honeypot anti-spam.
> - Estratégia de deploy dividida por app: `marketing-docs` (e opcionalmente `blog`) na **Vercel** (deploy nativo por push, `Root Directory` + `turbo-ignore`); `api` e `dashboard` continuam na **VPS** via GitHub Actions (SSH + Docker Compose), com `paths` filter para não redeployar a VPS por mudanças só na landing.
> - Organização em **GitHub Org** com branch única de longa duração (`main`, protegida), branches de feature curtas via PR; CI (lint/test/build) em todo PR, CD (deploy) em push na `main`.
>
> **Changelog v0.3:**
> - Monorepo expandido para **4 apps**: `api`, `dashboard`, `marketing-docs` (Next.js), `blog` (Next.js/Astro) — isolamento de blast radius e SEO.
> - Modelo de canal WhatsApp redefinido para **BYO-Instance**: cliente cadastra sua própria Evolution API; adapter ganha auto-configuração de webhook, tolerância a versão, e atribuição explícita de erro.
> - Agendamento reformulado em **duas camadas** (Postgres frio + promoção para BullMQ na janela de 24h), substituindo o modelo de delayed job direto na ingestão.
> - Autenticação trocada para **Better Auth** (Google OAuth + Magic Link via Nodemailer/SMTP), com entidades nativas no Prisma. A entidade de tenant foi renomeada de `Account` para `Organization` para não colidir com o `Account` do Better Auth.

---

## 1. Visão geral da arquitetura

Sistema multi-tenant composto por processos que compartilham Postgres e Redis, mais três apps de frontend independentes:

1. **API (Fastify)** — ingestão de agendamentos, webhooks de entrada do provider, autenticação (Better Auth), gestão BYO de instâncias, endpoints de métricas.
2. **Cron de promoção (Camada 2 do agendamento)** — varre `NotificationJob` `PENDING` no Postgres e materializa no BullMQ dentro da janela de curto prazo.
3. **Workers (BullMQ)** — envio via instância BYO do cliente, emissão de callbacks, retries.
4. **Reconciliation cron** — rede de segurança adicional que expira agendamentos sem resposta e reconcilia jobs perdidos no BullMQ.
5. **Painel (SPA estática)** — consome a API; sem servidor Node próprio.
6. **Marketing/Docs (Next.js)** — app de conteúdo público, isolado do produto autenticado.

```
                          ┌────────────────────────────────────────────────────────┐
  Sistema de origem       │                        Confirma API                     │
  (ERP/RIS/agenda)        │                                                          │
        │  POST /v1/appointments (HMAC)                                             │
        └───────────────► │  [Fastify] ──► valida ──► persiste Appointment ─────────┼──► Postgres
                          │        │                                                │
                          │        └──► cria NotificationJob (status PENDING) ──────┼──► Postgres (Camada 1 - "fria")
                          │                                                          │
                          │  [Cron de promoção] (a cada 1h) varre PENDING            │
                          │     dentro da janela de 24h ──► ENQUEUED ────────────────┼──► Redis (BullMQ, Camada 2)
                          │                                                          │
   WhatsApp do CLIENTE ◄──┼── [Worker: send] ◄── job vencido ───────────────────────┤
   (instância BYO)        │        │  via EvolutionProvider (URL/token do cliente)  │
        │                 │        └──► MessageLog (com categoria de erro)          │
        │  resposta 1/2/3 │                                                          │
        └───────────────► │  [Fastify webhook /webhooks/providers/:orgId] ──►       │
                          │        parse intent ──► state machine                    │
                          │        └──► enfileira callback ─────────────────────────┤
   Sistema de origem ◄────┼── [Worker: callback] (HMAC) ◄────────────────────────────┘
        (callbackUrl)     │
                          └── auth: Better Auth (Google OAuth / Magic Link via Resend)
                          └── waitlist: POST /v1/waitlist (form nativo em marketing) → Resend
```

---

## 2. Stack tecnológico

| Camada | Tecnologia | Justificativa |
|---|---|---|
| Monorepo | pnpm workspaces + Turborepo | Contrato Zod compartilhado entre os 3 apps; cache de build; config mínima (Nx seria peso desnecessário) |
| Runtime | Node.js 22 LTS + TypeScript | Base já dominada no Portal Master |
| HTTP | Fastify | Já em uso; performance + plugins |
| Validação | Zod (via `fastify-type-provider-zod`) | Schema único p/ validação e tipos |
| Doc de API | `@fastify/swagger` + `@scalar/fastify-api-reference` | Mesmo padrão do Portal Master |
| ORM | Prisma | Já em uso; também usado pelo Better Auth (adapter oficial) |
| Banco | PostgreSQL 15 | Já operado em VPS; agora também guarda a Camada 1 (fria) do agendamento |
| Fila/agendamento | BullMQ sobre Redis 7 | Usado só na **janela de curto prazo** (Camada 2) |
| **Autenticação** | **Better Auth** (Google OAuth + Magic Link) | Passwordless, integra nativamente com Prisma/TypeScript; elimina gestão de senha |
| **E-mail transacional** | **Resend** | Magic Link (Better Auth) e e-mail de confirmação da lista de espera; SDK oficial, domínio verificado via DNS na Cloudflare |
| **CORS** | `@fastify/cors` | Necessário porque o form de waitlist em `marketing` (Vercel) chama a API em outro domínio (`api.useconfirma.com`), já que os dois apps agora vivem em plataformas de deploy diferentes |
| Canal WhatsApp | Evolution API — **BYO-Instance do cliente** | Confirma não opera nem paga mensageria; cliente traz URL+token próprios |
| **Frontend (painel)** | TanStack Router + Vite (SPA) | Painel atrás de login, sem SEO/SSR; serve estático pelo Nginx (zero servidor Node p/ front) |
| **Data layer (front)** | TanStack Query | Par natural da API REST Fastify |
| **Marketing/Docs** | **Next.js** | Landing page de conversão + documentação técnica pública — precisa de SEO/SSR/SSG |

| Proxy/TLS | Nginx (Let's Encrypt) | Convenção atual; agora roteia 3 hosts |
| Logs | Pino (nativo do Fastify) | Estruturado |

**Por que Next.js aqui e não no painel:** `marketing` existe justamente para SEO — página institucional, documentação pública indexável e conteúdo orgânico. É o caso onde SSR/SSG do Next paga seu custo. O painel continua TanStack Router SPA porque é autenticado, sem necessidade de indexação, e se beneficia de ser 100% estático.

---

## 3. Estrutura do projeto (monorepo — 3 apps)

Monorepo **pnpm workspaces + Turborepo**. Raiz em `/var/www/confirma`, secrets em `.env` (por app), utilitários em `scripts/`.

O contrato do webhook (schemas Zod de ingestão e callback) vive em `packages/contracts` e é consumido por todos os apps que precisam dele (principalmente `api` e `painel`).

```
confirma/
├── apps/
│   ├── api/                          # Fastify — o produto (API + workers + auth)
│   │   ├── src/
│   │   │   ├── server.ts             # bootstrap da API
│   │   │   ├── app.ts                # build da instância Fastify + plugins
│   │   │   ├── config/env.ts         # validação de env com Zod
│   │   │   ├── auth/
│   │   │   │   ├── better-auth.ts    # instância do Better Auth (Prisma adapter)
│   │   │   │   └── mailer.ts         # client Resend p/ Magic Link + e-mails transacionais
│   │   │   ├── plugins/              # prisma, redis, api-key-auth (HMAC), rate-limit, cors, swagger
│   │   │   ├── modules/
│   │   │   │   ├── appointments/     # routes, service (ingestão)
│   │   │   │   ├── webhooks/         # entrada do provider (respostas)
│   │   │   │   ├── organizations/    # organizações + api keys + credenciais BYO
│   │   │   │   ├── waitlist/         # POST /v1/waitlist (form nativo, pré-lançamento)
│   │   │   │   └── painel/           # métricas (endpoints do painel)
│   │   │   ├── queue/
│   │   │   │   ├── connection.ts
│   │   │   │   ├── queues.ts
│   │   │   │   ├── workers/          # send.worker.ts, callback.worker.ts, index.ts
│   │   │   │   └── crons/
│   │   │   │       ├── promote.cron.ts     # Camada 2: PENDING → ENQUEUED
│   │   │   │       └── reconcile.cron.ts   # rede de segurança
│   │   │   ├── providers/
│   │   │   │   ├── provider.interface.ts
│   │   │   │   └── evolution.provider.ts   # BYO: usa providerConfig da Organization
│   │   │   ├── domain/               # state-machine.ts, intent-parser.ts
│   │   │   └── lib/                  # hmac.ts, crypto.ts, logger.ts
│   │   ├── prisma/schema.prisma
│   │   ├── scripts/                  # generate-api-key.ts, seed.ts, purge-expired.ts
│   │   ├── Dockerfile
│   │   └── package.json
│   ├── painel/                       # TanStack Router SPA (Vite)
│   │   ├── src/
│   │   │   ├── main.tsx
│   │   │   ├── router.tsx
│   │   │   ├── routes/               # login, overview, api-keys, byo-instance, logs
│   │   │   ├── lib/
│   │   │   │   ├── api-client.ts     # fetch tipado consumindo packages/contracts
│   │   │   │   └── auth-client.ts    # client oficial do Better Auth
│   │   │   ├── hooks/                # TanStack Query hooks
│   │   │   └── components/
│   │   ├── vite.config.ts
│   │   └── package.json
│   └── marketing/                    # Next.js — landing page + docs públicas
│       ├── app/                      # App Router: (marketing)/, waitlist/, docs/
│       │   └── (marketing)/
│       │       └── components/WaitlistForm.tsx   # form nativo, chama POST /v1/waitlist
│       ├── next.config.js
│       └── package.json                          # deploy: Vercel (Root Directory = apps/marketing)
├── packages/
│   ├── contracts/                    # schemas Zod + tipos compartilhados (webhook, callback)
│   │   ├── src/
│   │   │   ├── appointment.ts        # createAppointmentBody, etc.
│   │   │   ├── callback.ts           # payload de callback
│   │   │   ├── waitlist.ts           # waitlistBody — compartilhado entre marketing e api
│   │   │   └── index.ts
│   │   └── package.json
│   └── config/                       # tsconfig-base, eslint-config compartilhados
├── nginx/
│   ├── api.confirma.conf
│   ├── app.confirma.conf
│   └── www.confirma.conf             # marketing
├── docker-compose.yml
├── turbo.json
├── pnpm-workspace.yaml
├── .env.example
└── package.json                      # raiz (scripts turbo)
```

**`pnpm-workspace.yaml`**
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

**`turbo.json`** (essencial)
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**", ".next/**"] },
    "dev": { "cache": false, "persistent": true },
    "lint": {},
    "test": { "dependsOn": ["^build"] }
  }
}
```

Cada app declara `@confirma/contracts` como dependência de workspace (`"@confirma/contracts": "workspace:*"`) quando precisar do contrato — tipicamente `api` e `painel`; `marketing` normalmente não precisa.

---

## 4. Modelo de dados (Prisma)

> **Nota de nomenclatura:** o Better Auth exige uma entidade `Account` para representar identidades de login vinculadas (ex.: conta Google linkada a um `User`). Para evitar colisão, a entidade de tenant do produto (antes `Account`) foi renomeada para **`Organization`**.

```prisma
// apps/api/prisma/schema.prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }

enum ProviderType { EVOLUTION }

enum AppointmentStatus {
  RECEIVED
  PENDING              // NotificationJob em Postgres, fora do Redis (Camada 1)
  ENQUEUED             // promovido ao BullMQ (Camada 2)
  SENT
  AWAITING_RESPONSE
  CONFIRMED
  CANCELLED
  RESCHEDULE_REQUESTED
  NO_RESPONSE
  DELIVERY_FAILED
}

enum NotificationJobStatus { PENDING ENQUEUED DISPATCHED FAILED CANCELLED }

enum ErrorCategory { CLIENT_INSTANCE_ERROR CONFIRMA_INTERNAL_ERROR }

// ──────────────────────────────────────────────────────────────
// Entidades nativas do Better Auth (login do painel)
// ──────────────────────────────────────────────────────────────

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  emailVerified Boolean   @default(false)
  name          String?
  image         String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  sessions      Session[]
  accounts      Account[]
  memberships   Membership[]

  @@map("users")
}

model Session {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  token     String   @unique
  expiresAt DateTime
  ipAddress String?
  userAgent String?
  createdAt DateTime @default(now())

  @@map("sessions")
}

// Identidade de login vinculada (Google OAuth, Magic Link). Nome exigido pelo Better Auth.
model Account {
  id                String   @id @default(cuid())
  userId            String
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  providerId        String                          // "google" | "magic-link"
  accountId         String                          // id da conta no provider externo
  accessToken       String?
  refreshToken      String?
  expiresAt         DateTime?
  createdAt         DateTime @default(now())

  @@unique([providerId, accountId])
  @@map("auth_accounts")
}

model Verification {
  id         String   @id @default(cuid())
  identifier String                                 // e-mail do Magic Link
  value      String
  expiresAt  DateTime
  createdAt  DateTime @default(now())

  @@map("verifications")
}

// ──────────────────────────────────────────────────────────────
// Tenant do produto (renomeado de "Account" para "Organization")
// ──────────────────────────────────────────────────────────────

model Organization {
  id             String        @id @default(cuid())
  name           String
  callbackUrl    String?
  defaultOffsets Json          @default("[\"24h\",\"3h\"]")

  // BYO-Instance: credenciais da instância Evolution do próprio cliente,
  // criptografadas em app-layer (AES-256-GCM) antes de persistir.
  providerType    ProviderType @default(EVOLUTION)
  providerConfig  Json?        // { baseUrlEnc, tokenEnc, webhookConfigured, lastHealthCheckAt, lastHealthCheckOk }

  createdAt      DateTime      @default(now())

  memberships    Membership[]
  apiKeys        ApiKey[]
  appointments   Appointment[]
  templates      Template[]

  @@map("organizations")
}

// Liga User (login) a Organization (tenant) — permite múltiplos usuários por conta
model Membership {
  id             String       @id @default(cuid())
  userId         String
  user           User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  role           String       @default("owner")      // owner | member
  createdAt      DateTime     @default(now())

  @@unique([userId, organizationId])
  @@map("memberships")
}

model ApiKey {
  id             String       @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  publicId       String       @unique          // X-Api-Key (ex.: ak_live_xxx) — usado no lookup
  secretEnc      String                         // secret HMAC, criptografado (AES-GCM)
  revokedAt      DateTime?
  createdAt      DateTime     @default(now())

  @@index([organizationId])
  @@map("api_keys")
}

model Appointment {
  id             String            @id @default(cuid())
  organizationId String
  organization   Organization      @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  externalId     String                                  // id no sistema de origem
  idempotencyKey String            @unique
  status         AppointmentStatus @default(RECEIVED)

  // dados minimizados do paciente
  patientName    String
  patientPhone   String                                  // criptografado em repouso
  examType       String
  examAt         DateTime
  location       String?
  professional   String?

  offsets        Json                                    // ["24h","3h"]
  callbackUrl    String?                                  // efetiva (req > org)

  purgeAfter     DateTime                                 // TTL LGPD

  createdAt      DateTime          @default(now())
  updatedAt      DateTime          @updatedAt

  jobs           NotificationJob[]
  messages       MessageLog[]
  inbound        InboundEvent[]
  callbacks      CallbackLog[]

  @@unique([organizationId, externalId])
  @@index([organizationId, status])
  @@index([examAt])
  @@map("appointments")
}

model NotificationJob {
  id            String                 @id @default(cuid())
  appointmentId String
  appointment   Appointment            @relation(fields: [appointmentId], references: [id], onDelete: Cascade)
  offset        String                                     // "24h"
  runAt         DateTime
  status        NotificationJobStatus  @default(PENDING)   // Camada 1: PENDING; Camada 2: ENQUEUED
  bullJobId     String?                                    // id no BullMQ, preenchido só na promoção
  promotedAt    DateTime?                                  // quando o cron materializou no Redis
  createdAt     DateTime               @default(now())

  @@index([appointmentId])
  @@index([status, runAt])                                 // usado pelo cron de promoção
  @@map("notification_jobs")
}

model MessageLog {
  id                String        @id @default(cuid())
  appointmentId     String
  appointment       Appointment   @relation(fields: [appointmentId], references: [id], onDelete: Cascade)
  provider          ProviderType
  providerMessageId String?
  status            String                              // sent|delivered|failed
  errorCategory     ErrorCategory?                       // atribuição clara: cliente vs. Confirma
  attempt           Int           @default(1)
  error             String?
  createdAt         DateTime      @default(now())

  @@index([appointmentId])
  @@map("message_logs")
}

model InboundEvent {
  id            String       @id @default(cuid())
  appointmentId String?
  appointment   Appointment? @relation(fields: [appointmentId], references: [id], onDelete: SetNull)
  provider      ProviderType
  rawPayload    Json
  parsedIntent  String?                             // confirm|cancel|reschedule|unknown
  createdAt     DateTime     @default(now())

  @@map("inbound_events")
}

model CallbackLog {
  id            String      @id @default(cuid())
  appointmentId String
  appointment   Appointment @relation(fields: [appointmentId], references: [id], onDelete: Cascade)
  event         String
  status        String                              // success|failed|pending
  httpStatus    Int?
  attempt       Int         @default(1)
  createdAt     DateTime    @default(now())

  @@index([appointmentId])
  @@map("callback_logs")
}

model Template {
  id             String       @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  key            String                                 // "reminder_default"
  provider       ProviderType
  category       String       @default("utility")       // sempre utility
  body           String                                 // com placeholders {{patientName}} etc.

  @@unique([organizationId, key, provider])
  @@map("templates")
}
```

**Notas**
- `patientPhone` e `providerConfig` (`baseUrlEnc`/`tokenEnc`) são criptografados em camada de aplicação (AES-256-GCM) antes de persistir — o banco nunca guarda em claro (RNF-02, RNF-08).
- `purgeAfter` guia o job de expurgo LGPD (seção 11).
- `idempotencyKey` único garante RF-04; `@@unique([organizationId, externalId])` é a segunda barreira.
- `NotificationJob.status` + índice `[status, runAt]` são a base do cron de promoção (seção 6).
- `MessageLog.errorCategory` é o campo que alimenta a atribuição de erro no painel (RF-29 do PRD).

---

## 5. API — implementação

### 5.1 Autenticação — dois mecanismos distintos

O Confirma tem **duas superfícies de autenticação** que não devem ser confundidas:

1. **Login humano do painel** — Better Auth (Google OAuth / Magic Link), gera sessão via cookie `httpOnly`. Usado pelas rotas do painel (`/v1/metrics`, `/v1/api-keys`, `/v1/organizations/*`).
2. **API key de integração** — usada pelo sistema de origem do dev na rota pública `POST /v1/appointments`. Não passa pelo Better Auth; é o par `publicId`/`secretEnc` + HMAC.

#### 5.1.1 Better Auth (login do painel)

```typescript
// apps/api/src/auth/better-auth.ts
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "../plugins/prisma";
import { sendMagicLinkEmail } from "./mailer";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  plugins: [
    // plugin de magic link do Better Auth, despachando via Resend
    magicLink({
      sendMagicLink: async ({ email, url }) => sendMagicLinkEmail(email, url),
    }),
  ],
  session: { cookieCache: { enabled: true } },
});
```

```typescript
// apps/api/src/auth/mailer.ts
import { Resend } from "resend";

export const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.MAIL_FROM ?? "Confirma <no-reply@useconfirma.com>";

export async function sendMagicLinkEmail(email: string, url: string) {
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: "Seu link de acesso ao Confirma",
    html: `<p>Clique para entrar: <a href="${url}">${url}</a></p>`,
  });
}
```

O mesmo client (`resend`) é reutilizado pelo módulo de waitlist (seção 6.5) — um único `mailer.ts` centraliza todo envio transacional da API, evitando duas configurações de e-mail divergentes.

O Fastify monta as rotas do Better Auth (`/api/auth/*`) via handler HTTP nativo; o painel consome via `auth-client.ts` (client oficial do Better Auth), e o Nginx do host `app.useconfirma.com` faz proxy reverso dessas rotas para a API, preservando o cookie `httpOnly` no mesmo domínio efetivo do painel.

#### 5.1.2 API key + HMAC (ingestão pública)

Fluxo inalterado do design anterior:

1. Ler `X-Api-Key` (`publicId`) → buscar `ApiKey` ativa (`revokedAt = null`) → obter `organizationId`.
2. Descriptografar `secretEnc` → obter secret HMAC.
3. Recalcular `HMAC-SHA256(rawBody, secret)` e comparar em tempo constante com `X-Signature`.
4. Anexar `organizationId` ao contexto da request.

```typescript
// apps/api/src/lib/hmac.ts
import { createHmac, timingSafeEqual } from "node:crypto";

export function sign(rawBody: Buffer | string, secret: string): string {
  return createHmac("sha256", secret).update(rawBody).digest("hex");
}

export function verify(rawBody: Buffer | string, secret: string, signature: string): boolean {
  const expected = sign(rawBody, secret);
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(signature ?? "", "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
```

> Importante: o corpo bruto (raw) deve ser capturado antes do parse JSON — configurar `addContentTypeParser` no Fastify para preservar o buffer original, senão a assinatura não bate.

### 5.2 Rotas

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| POST | `/v1/appointments` | API key + HMAC | Ingestão (RF-01) |
| POST | `/webhooks/providers/:organizationId` | assinatura/token da instância do cliente | Respostas do paciente (RF-18) |
| GET | `/v1/appointments/:id` | API key | Consulta de status |
| ALL | `/api/auth/*` | — (gerido pelo Better Auth) | Login (Google/Magic Link), sessão, logout |
| POST | `/v1/api-keys` | sessão do painel (Better Auth) | Gera/rotaciona key (RF-27) |
| PUT | `/v1/organizations/byo-instance` | sessão do painel | Cadastra/atualiza URL+token da instância BYO (RF-14) |
| POST | `/v1/organizations/byo-instance/test` | sessão do painel | Health-check da instância cadastrada (RF-16) |
| GET | `/v1/metrics` | sessão do painel | Métricas do painel (RF-28) |
| POST | `/v1/sandbox/appointments` | API key sandbox | Envio simulado (RF-30) |
| POST | `/v1/waitlist` | pública (rate limit + honeypot) | Cadastro de lista de espera + e-mail de confirmação (RF-32..35) |

### 5.3 Validação (Zod) — via `packages/contracts`

Os schemas de ingestão e callback moram no pacote compartilhado e são importados pela API (validação em runtime) e pelo painel (tipos + validação de forms). Fonte única de verdade do contrato.

```typescript
// packages/contracts/src/appointment.ts
import { z } from "zod";

export const createAppointmentBody = z.object({
  externalId: z.string().min(1),
  patient: z.object({
    name: z.string().min(1),
    phone: z.string().regex(/^\+[1-9]\d{7,14}$/), // E.164
  }),
  appointment: z.object({
    type: z.string().min(1),
    datetime: z.string().datetime({ offset: true }),
    location: z.string().optional(),
    professional: z.string().optional(),
  }),
  notification: z.object({
    channels: z.array(z.enum(["whatsapp"])).default(["whatsapp"]),
    reminderOffsets: z.array(z.string().regex(/^\d+[hm]$/)).optional(),
  }).optional(),
  callbackUrl: z.string().url().optional(),
});
```

```typescript
// packages/contracts/src/byo-instance.ts
export const byoInstanceConfig = z.object({
  baseUrl: z.string().url(),
  token: z.string().min(1),
});
```

### 5.4 Fluxo de ingestão (`appointments.service.ts`)

1. Resolver `Idempotency-Key` → se já existe, retornar `200` com o `appointmentId` existente.
2. Calcular `offsets` efetivos (req > org) e `callbackUrl` efetiva.
3. Persistir `Appointment` (`RECEIVED`) + `purgeAfter = examAt + retençãoLegal`.
4. Para cada offset, criar `NotificationJob` com status **`PENDING`** — **sem tocar o BullMQ** (Camada 1).
5. Atualizar `Appointment.status` → `PENDING`. Responder `202` com `appointmentId`.

> A materialização no Redis não acontece aqui — é responsabilidade do cron de promoção (seção 6.2).

### 5.5 Lista de espera (`POST /v1/waitlist`)

Módulo isolado do produto principal — não passa pela autenticação de API key/HMAC nem pela sessão do Better Auth, já que é chamado por um visitante anônimo direto do formulário em `apps/marketing`.

**Modelo de dados:**

```prisma
// apps/api/prisma/schema.prisma (adição)
model WaitlistLead {
  id           String   @id @default(cuid())
  name         String
  email        String   @unique
  whatsapp     String?
  company      String?
  clientsCount String?                              // "nenhuma" | "1" | "2-5" | "5+"
  interest     String?                               // "reduzir_faltas" | "nao_construir_fila" | "byo" | "documentacao" | "outro"
  source       String?
  createdAt    DateTime @default(now())

  @@map("waitlist_leads")
}
```

**Contrato compartilhado:**

```typescript
// packages/contracts/src/waitlist.ts
import { z } from "zod";

export const waitlistBody = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  whatsapp: z.string().optional(),
  company: z.string().optional(),
  clientsCount: z.enum(["nenhuma", "1", "2-5", "5+"]).optional(),
  interest: z.enum(["reduzir_faltas", "nao_construir_fila", "byo", "documentacao", "outro"]).optional(),
  source: z.string().optional(),
  // honeypot: campo invisível via CSS; humano nunca preenche, bot preenche.
  website: z.string().max(0).optional(),
});

export type WaitlistBody = z.infer<typeof waitlistBody>;
```

**Rota:**

```typescript
// apps/api/src/modules/waitlist/waitlist.routes.ts
import { waitlistBody } from "@confirma/contracts";
import { resend } from "../../auth/mailer";
import { prisma } from "../../plugins/prisma";

fastify.post(
  "/v1/waitlist",
  { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
  async (request, reply) => {
    const parsed = waitlistBody.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send({ error: parsed.error.flatten() });

    // honeypot preenchido → descarta silenciosamente, sem alertar o bot
    if (parsed.data.website) return reply.code(200).send({ ok: true });

    const { website, ...data } = parsed.data;
    const lead = await prisma.waitlistLead.upsert({
      where: { email: data.email },
      create: data,
      update: data,
    });

    await resend.emails.send({
      from: process.env.MAIL_FROM!,
      to: lead.email,
      subject: "Você garantiu acesso antecipado ao Confirma",
      html: `<p>Oi, ${lead.name}! Você garantiu acesso antecipado à documentação técnica do Confirma. Em breve mandamos o link de acesso.</p>`,
    });

    return reply.code(200).send({ ok: true });
  },
);
```

**Pontos de atenção específicos deste endpoint:**
- **CORS** — precisa liberar explicitamente a origem `https://www.useconfirma.com` via `@fastify/cors`, já que a chamada vem do navegador em outro domínio (Vercel), não server-to-server como seria com um webhook de terceiro.
- **Rate limit por IP** (5 req/min) é a principal defesa anti-abuso aqui — não há API key nem HMAC nessa rota, então o rate limit + honeypot substituem a camada de confiança que existiria com um provedor de formulário externo.
- **Idempotência por e-mail** (`upsert`), não por `Idempotency-Key` — o mesmo lead pode reenviar o formulário sem gerar duplicata nem novo e-mail de boas-vindas incorreto (o e-mail é reenviado a cada upsert atualmente; se isso incomodar, adicionar um campo `notifiedAt` e só enviar quando nulo).
- **Sem fluxo de notificação em massa** — o e-mail de confirmação é o único disparo automático deste módulo. Um broadcast de lançamento para todos os leads, se vier a existir, é decisão de fase futura e usaria uma ferramenta separada (ex.: Resend Broadcasts/Audiences), não este endpoint.

---

## 6. Agendamento em duas camadas (Postgres + BullMQ)

### 6.1 Motivação

Agendamentos podem ser marcados com semanas ou meses de antecedência. Manter um delayed job no Redis desde a ingestão faria o Redis acumular jobs de longuíssimo prazo — custo de memória, risco em caso de flush/restart, e dificuldade de cancelar/alterar sem tocar em chaves do Redis. A solução em duas camadas resolve isso:

- **Camada 1 (fria, Postgres):** todo `NotificationJob` nasce aqui com `status = PENDING`. Cancelamentos e alterações antes da promoção são só UPDATE/DELETE relacional — trivial e sem custo de fila.
- **Camada 2 (quente, Redis/BullMQ):** só jobs cujo `runAt` está dentro da janela de curto prazo (ex.: próximas 24h) são materializados no BullMQ, com o delay exato em milissegundos restante.

### 6.2 Cron de promoção

```typescript
// apps/api/src/queue/crons/promote.cron.ts
import { sendQueue } from "../queues";
import { prisma } from "../../plugins/prisma";

const PROMOTION_WINDOW_HOURS = 24;

export async function promotePendingJobs() {
  const windowEnd = new Date(Date.now() + PROMOTION_WINDOW_HOURS * 60 * 60 * 1000);

  const dueJobs = await prisma.notificationJob.findMany({
    where: { status: "PENDING", runAt: { lte: windowEnd } },
  });

  for (const job of dueJobs) {
    const delayMs = Math.max(0, job.runAt.getTime() - Date.now());
    const bullJobId = `${job.appointmentId}:${job.offset}`; // idempotência nativa do BullMQ

    await sendQueue.add(
      "reminder",
      { appointmentId: job.appointmentId, offset: job.offset, notificationJobId: job.id },
      {
        delay: delayMs,
        jobId: bullJobId,       // blinda contra duplicidade em concorrência/restart do cron
        attempts: 5,
        backoff: { type: "exponential", delay: 30_000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    );

    await prisma.notificationJob.update({
      where: { id: job.id },
      data: { status: "ENQUEUED", bullJobId, promotedAt: new Date() },
    });
  }
}
```

Executado a cada 1h (ex.: via `node-cron` ou job repetível do próprio BullMQ). Idempotente por natureza: se rodar duas vezes sobre o mesmo job antes do UPDATE completar, o `jobId` fixo do BullMQ (`${appointmentId}:${offset}`) rejeita a duplicata silenciosamente.

### 6.3 Cancelamento antes da promoção

```typescript
// Cancelamento trivial enquanto o job ainda está em PENDING (Camada 1)
await prisma.notificationJob.updateMany({
  where: { appointmentId, status: "PENDING" },
  data: { status: "CANCELLED" },
});
// Nenhuma chamada ao Redis é necessária — o job nunca existiu lá.
```

Se o job já foi promovido (`ENQUEUED` ou além), o cancelamento precisa remover o job do BullMQ (`Job.remove()`) além de atualizar o Postgres — caso mais raro, tratado no worker de cancelamento.

### 6.4 Worker de envio e worker de callback

```typescript
// apps/api/src/queue/queues.ts
import { Queue } from "bullmq";
import { connection } from "./connection";

export const sendQueue = new Queue("send", { connection });
export const callbackQueue = new Queue("callback", { connection });
```

**Worker de envio** (`send.worker.ts`):
1. Carregar `Appointment`; se já terminal (confirmed/cancelled), no-op.
2. Renderizar template da organização (categoria utility).
3. `provider.sendTemplate(...)` usando as credenciais BYO da `Organization` → gravar `MessageLog` (com `errorCategory` se falhar).
4. Transição `SENT` → `AWAITING_RESPONSE`.
5. Se for o último offset, agendar expiração (`NO_RESPONSE`) via delayed job.

**Worker de callback** (`callback.worker.ts`):
- `POST` para `callbackUrl` com corpo assinado (`X-Confirma-Signature`). Retry com backoff; grava `CallbackLog`.

**Cron de reconciliação** (`reconcile.cron.ts`, a cada 5 min): rede de segurança adicional — reenfileira `ENQUEUED` cujo `bullJobId` sumiu do Redis (ex.: perda de dados), e expira `AWAITING_RESPONSE` além do prazo. Independente do cron de promoção (seção 6.2), que cuida da transição `PENDING → ENQUEUED`.

---

## 7. Adapter de provider — BYO-Instance

Interface única; única implementação no MVP é a Evolution API, mas sempre resolvendo credenciais **da `Organization` autenticada**, nunca de configuração global do Confirma.

```typescript
// apps/api/src/providers/provider.interface.ts
export interface SendTemplateParams {
  to: string;                       // E.164
  templateKey: string;
  variables: Record<string, string>;
  instanceConfig: { baseUrl: string; token: string }; // credenciais BYO já descriptografadas
}

export interface SendResult {
  providerMessageId: string;
  status: "sent" | "queued" | "failed";
  errorCategory?: "client_instance_error" | "confirma_internal_error";
}

export interface WhatsAppProvider {
  sendTemplate(params: SendTemplateParams): Promise<SendResult>;
  parseInbound(rawPayload: unknown): { from: string; text: string } | null;
  configureWebhook(instanceConfig: { baseUrl: string; token: string }, webhookUrl: string): Promise<boolean>;
  healthCheck(instanceConfig: { baseUrl: string; token: string }): Promise<{ ok: boolean; detail?: string }>;
}
```

### 7.1 `evolution.provider.ts` — pontos específicos do BYO

- **`sendTemplate`** — chama `instanceConfig.baseUrl` com `instanceConfig.token` (nunca uma instância própria do Confirma). Erros de rede/autenticação (`401`, `ECONNREFUSED`, timeout) são mapeados para `errorCategory: "client_instance_error"`; qualquer erro do lado do Confirma (bug de serialização, exceção interna) vira `"confirma_internal_error"`.
- **`configureWebhook`** — chamado uma vez, ao salvar as credenciais no painel (RF-15): tenta configurar programaticamente a URL `/webhooks/providers/:organizationId` na instância do cliente. Se a chamada falhar (endpoint inexistente, versão incompatível), retorna `false` e o painel exibe instrução de configuração manual.
- **`healthCheck`** — usado pelo botão de "testar conexão" no painel (RF-16); grava `providerConfig.lastHealthCheckAt` / `lastHealthCheckOk` na `Organization`.
- **Resiliência de versão (RF-17)** — o parser de resposta da instância deve tolerar campos ausentes/renomeados entre versões da Evolution API: usar acesso opcional/defensivo (`?.`) e validação Zod permissiva (campos desconhecidos ignorados, não obrigatórios) em vez de um schema estrito que quebra em variações do cliente.

```typescript
// apps/api/src/providers/evolution.provider.ts (esboço)
export const evolutionProvider: WhatsAppProvider = {
  async sendTemplate({ to, templateKey, variables, instanceConfig }) {
    try {
      const res = await fetch(`${instanceConfig.baseUrl}/message/sendTemplate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${instanceConfig.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ to, templateKey, variables }),
      });
      if (res.status === 401) {
        return { providerMessageId: "", status: "failed", errorCategory: "client_instance_error" };
      }
      const data = await res.json().catch(() => ({}));
      // acesso defensivo — tolera variações de schema entre versões do cliente
      const messageId = data?.messageId ?? data?.id ?? data?.key?.id ?? "";
      return { providerMessageId: messageId, status: "sent" };
    } catch (err) {
      // falha de conexão (ECONNREFUSED, timeout) = problema da instância do cliente
      return { providerMessageId: "", status: "failed", errorCategory: "client_instance_error" };
    }
  },

  async configureWebhook(instanceConfig, webhookUrl) {
    try {
      const res = await fetch(`${instanceConfig.baseUrl}/webhook/set`, {
        method: "POST",
        headers: { Authorization: `Bearer ${instanceConfig.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url: webhookUrl, events: ["messages.upsert"] }),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  async healthCheck(instanceConfig) {
    try {
      const res = await fetch(`${instanceConfig.baseUrl}/instance/connectionState`, {
        headers: { Authorization: `Bearer ${instanceConfig.token}` },
      });
      return { ok: res.ok, detail: res.ok ? undefined : `HTTP ${res.status}` };
    } catch (err) {
      return { ok: false, detail: (err as Error).message };
    }
  },

  parseInbound(rawPayload) {
    const p = rawPayload as any;
    const from = p?.data?.key?.remoteJid ?? p?.from ?? null;
    const text = p?.data?.message?.conversation ?? p?.text ?? null;
    if (!from || !text) return null;
    return { from, text };
  },
};
```

**Regra de negócio:** templates são estritamente transacionais (utility) — orientação de boas práticas na documentação, mesmo sabendo que o risco de reclassificação/ban agora é do cliente, não do Confirma (ver PRD §12).

---

## 8. Parsing de intenção e máquina de estados

```typescript
// apps/api/src/domain/intent-parser.ts
export type Intent = "confirm" | "cancel" | "reschedule" | "unknown";

export function parseIntent(text: string): Intent {
  const t = text.trim().toLowerCase();
  if (/^1\b/.test(t) || /\b(confirmo|confirmar|sim)\b/.test(t)) return "confirm";
  if (/^2\b/.test(t) || /\b(cancelar|desmarcar|nao|não)\b/.test(t)) return "cancel";
  if (/^3\b/.test(t) || /\b(remarcar|reagendar)\b/.test(t)) return "reschedule";
  return "unknown";
}
```

Transições permitidas (`state-machine.ts`), incluindo os novos estados de duas camadas:

```
RECEIVED  → PENDING
PENDING   → ENQUEUED | CANCELLED               (cancelamento direto, RF-10)
ENQUEUED  → SENT | DELIVERY_FAILED
SENT      → AWAITING_RESPONSE | DELIVERY_FAILED
AWAITING_RESPONSE → CONFIRMED | CANCELLED | RESCHEDULE_REQUESTED | NO_RESPONSE
```

Toda transição para estado terminal enfileira um job na `callbackQueue` (RF-22). `unknown` dispara re-pergunta dentro da janela de 24h (gratuita) sem mudar de estado.

---

## 9. Frontend

### 9.1 Painel (`apps/painel`)

Painel administrativo atrás de login. **SPA** com TanStack Router + Vite, compilado para assets estáticos e servido pelo Nginx.

**Escopo de telas (MVP):**
- **Login** — Google OAuth ou Magic Link, via `auth-client.ts` do Better Auth. Sem formulário de senha.
- **Overview** — métricas: taxa de confirmação, faltas evitadas, volume de mensagens (consome `GET /v1/metrics`).
- **Instância BYO** — formulário para cadastrar URL + token da Evolution do cliente; botão "testar conexão" (health-check); indicador se o webhook foi auto-configurado ou precisa de passo manual.
- **API keys** — gerar, rotacionar e revogar keys de integração (RF-27); secret exibido uma única vez.
- **Logs de agendamento** — trilha por agendamento, com destaque visual quando a falha for `client_instance_error` vs. `confirma_internal_error` (RF-29).

**Padrões:**
- Roteamento file-based do TanStack Router; rotas autenticadas protegidas por `beforeLoad` consultando a sessão via `auth-client`.
- Data layer: TanStack Query para todo acesso à API.
- Client tipado: `lib/api-client.ts` importa os schemas de `@confirma/contracts`.
- Auth: sessão via cookie `httpOnly` emitido pelo Better Auth na API, repassado pelo proxy reverso do Nginx do mesmo host (`app.useconfirma.com`) — nunca token em `localStorage`.

**Build e distribuição:** `pnpm --filter @confirma/app build` gera `apps/painel/dist` (estático), servido pelo host `app.` do Nginx.

### 9.2 Marketing/Docs (`apps/marketing`)

- **`marketing`** (Next.js): landing page institucional (conversão) + documentação técnica pública do webhook/contrato, usando os mesmos exemplos de payload de `packages/contracts` (sem expor segredos). SSR/SSG para SEO.
- App **público, não autenticado**, com deploy e ciclo de vida independentes do produto — uma instabilidade nele não deve afetar `api` nem `painel` (isolamento de blast radius).

---

## 10. Segurança

- **RNF-01/03** — HTTPS obrigatório (Nginx + Let's Encrypt); HMAC em ingestão e callback.
- **API keys de integração** — `publicId` para lookup; secret HMAC criptografado com AES-256-GCM (`crypto.ts`), chave mestra em `APP_ENCRYPTION_KEY` (env). Rotação gera novo par e revoga o antigo.
- **Credenciais BYO** — `baseUrl`/`token` da instância do cliente criptografados com o mesmo esquema AES-GCM, nunca expostos de volta em claro após o cadastro (só indicador de "configurado"/"últimos 4 caracteres do token").
- **Sessão do painel** — delegada ao Better Auth: cookie `httpOnly`, `Secure`, `SameSite`; Magic Link de uso único com TTL curto.
- **Rate limiting** — `@fastify/rate-limit` por `organizationId` na rota pública (RF-06), com limites configuráveis.
- **Verificação de webhook do provider** — validação do payload recebido na rota `/webhooks/providers/:organizationId` contra o token/segredo configurado na instância do cliente.
- **PII** — nunca em query string (RNF-04); logs sem telefone/nome em claro; `patientPhone` mascarado em logs.

```typescript
// apps/api/src/lib/crypto.ts (esboço AES-256-GCM)
import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
const KEY = Buffer.from(process.env.APP_ENCRYPTION_KEY!, "hex"); // 32 bytes

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, enc].map(b => b.toString("base64")).join(".");
}

export function decrypt(payload: string): string {
  const [iv, tag, enc] = payload.split(".").map(s => Buffer.from(s, "base64"));
  const d = createDecipheriv("aes-256-gcm", KEY, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
}
```

---

## 11. LGPD — implementação técnica

- **Minimização (RNF-06):** persistir só nome, telefone, tipo e horário do exame. Nada de CPF, prontuário ou laudo.
- **Criptografia em repouso (RNF-08):** `patientPhone` e credenciais BYO via AES-GCM.
- **TTL / expurgo (RNF-07):** cron diário apaga/anonimiza `Appointment` com `purgeAfter < now()`.
- **Operador (RNF-09):** Confirma trata dados do paciente em nome da `Organization` (controladora); DPA por conta. O Confirma **não é responsável pelo canal de disparo em si** (é BYO do cliente) — isso deve constar explicitamente no DPA. O opt-in do paciente é responsabilidade do sistema de origem (a definir no PRD §16).
- **Direito de exclusão (RNF-10):** endpoint administrativo para expurgo sob demanda por `externalId`/telefone.

```typescript
// apps/api/scripts/purge-expired.ts (via cron diário)
await prisma.appointment.updateMany({
  where: { purgeAfter: { lt: new Date() } },
  data: { patientName: "[purged]", patientPhone: "[purged]" },
});
```

---

## 12. Multi-tenancy

- Isolamento lógico por `organizationId` em todas as tabelas e queries (renomeado de `accountId`).
- Todo acesso a dados passa por `organizationId` do contexto autenticado (via API key ou via sessão Better Auth + `Membership`); nunca confiar em `organizationId` vindo do corpo.
- Um `User` pode pertencer a mais de uma `Organization` via `Membership` (ex.: consultor que atende várias clínicas) — o painel deve prever seletor de organização ativa se isso ocorrer.
- Filas compartilhadas; o `organizationId` viaja no payload do job.

---

## 13. Observabilidade

- **Logs (Pino):** structured logging com `appointmentId`/`organizationId` como correlação, cobrindo ingestão → promoção → envio → resposta → callback (RNF-16). PII mascarada.
- **Métricas:** contadores de mensagens enviadas, taxa de entrega, taxa de callback, falhas por fila **segmentadas por `errorCategory`** (cliente vs. Confirma). Expor `/health` e `/metrics`.
- **Alertas:** falha de envio acima de threshold (separando por categoria de erro) e fila de callback crescendo (RNF-17).

---

## 14. Infraestrutura e deploy

### 14.1 docker-compose.yml

```yaml
# Build a partir da raiz do monorepo (precisa das deps de workspace).
# marketing NÃO entra aqui — vai para a Vercel (ver 14.2).
# painel também não entra como serviço: é estático, o Nginx serve o build direto.
services:
  api:
    build: { context: ., dockerfile: apps/api/Dockerfile }
    command: node apps/api/dist/server.js
    env_file: ./apps/api/.env
    depends_on: [postgres, redis]
    restart: always
    ports: ["3000:3000"]

  worker:
    build: { context: ., dockerfile: apps/api/Dockerfile }
    command: node apps/api/dist/queue/workers/index.js
    env_file: ./apps/api/.env
    depends_on: [postgres, redis]
    restart: always

  promote-cron:
    build: { context: ., dockerfile: apps/api/Dockerfile }
    command: node apps/api/dist/queue/crons/promote.cron.js
    env_file: ./apps/api/.env
    depends_on: [postgres, redis]
    restart: always

  postgres:
    image: postgres:15
    environment:
      POSTGRES_USER: confirma
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: confirma
    volumes: ["pgdata:/var/lib/postgresql/data"]
    restart: always

  redis:
    image: redis:7
    command: redis-server --appendonly yes
    volumes: ["redisdata:/data"]
    restart: always

volumes:
  pgdata:
  redisdata:
```

> `promote-cron` roda como processo dedicado (evita que o cron de promoção compita por recursos com a API ou pare junto se a API reiniciar). Alternativa mais simples: um job repetível do próprio BullMQ dentro do processo `worker`, se a operação preferir menos containers.

### 14.2 Divisão de deploy: Vercel (frontend público) + VPS (produto)

| App | Onde roda | Como | Domínio |
|---|---|---|---|
| `api` | VPS (Docker Compose) | GitHub Actions → SSH | `api.useconfirma.com` |
| `painel` | VPS (Nginx estático) | GitHub Actions → SSH (build + copia `dist/`) | `app.useconfirma.com` |
| `marketing` | **Vercel** | Integração nativa Vercel ↔ GitHub | `www.useconfirma.com` |

**Setup na Vercel (`marketing`):**
1. **Add New Project → importa o repositório da org**.
2. **Root Directory** = `apps/marketing` — a Vercel entende monorepo a partir daí, instala e builda só aquele workspace.
3. Deploy automático nativo: push na `main` → produção; push em branch/PR → preview URL. Não passa pelo GitHub Actions.
4. **Project Settings → Git → Ignored Build Step:**
   ```bash
   npx turbo-ignore
   ```
   Usa o grafo de dependências do Turborepo para pular o build da Vercel quando o commit não afeta aquele app (ex.: mudança só em `apps/api`).
5. Variáveis de ambiente da Vercel: `NEXT_PUBLIC_API_URL=https://api.useconfirma.com` (para o `WaitlistForm.tsx` chamar `POST /v1/waitlist`).

**GitHub Actions (`api` + `painel` na VPS)** é restrito por `paths`, para não redeployar a VPS por mudanças que só afetam `marketing`:

```yaml
# .github/workflows/deploy.yml
on:
  push:
    branches: [main]
    paths:
      - "apps/api/**"
      - "apps/painel/**"
      - "packages/**"
      - "docker-compose.yml"
      - ".github/workflows/deploy.yml"
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo build
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd /var/www/confirma
            git pull origin main
            pnpm install --frozen-lockfile
            pnpm turbo build
            pnpm --filter api exec prisma migrate deploy
            docker compose build && docker compose up -d
```

**CI (`.github/workflows/ci.yml`)** roda em todo PR, independente de qual app mudou:

```yaml
on: pull_request
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo lint test build
```

**Estratégia de branches:** `main` única, protegida (PR obrigatório + status check do CI + sem force-push). Branches de feature curtas (`feat/`, `fix/`, `chore/`) via PR; merge (squash) na `main` dispara deploy automático — tanto o da VPS (Actions) quanto o da Vercel (nativo), cada um filtrando por `paths` o que realmente precisa rebuildar.

### 14.3 Nginx — 2 hosts na VPS (`api` e `app`)

Com `marketing` migrado para a Vercel, o Nginx da VPS passa a rotear só os dois hosts que continuam lá.

Cada app tem seu próprio server block, isolando falhas entre eles.

```nginx
# API pública — integradores chamam aqui
server {
    listen 443 ssl http2;
    server_name api.useconfirma.com;

    ssl_certificate     /etc/letsencrypt/live/api.useconfirma.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.useconfirma.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Painel — SPA estática + proxy das rotas de API e de auth
server {
    listen 443 ssl http2;
    server_name app.useconfirma.com;

    ssl_certificate     /etc/letsencrypt/live/app.useconfirma.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.useconfirma.com/privkey.pem;

    root /var/www/confirma/apps/painel/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;   # SPA fallback (client-side routing)
    }

    # chamadas do painel à API, incluindo as rotas do Better Auth
    location ~ ^/(v1|webhooks|api/auth)/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Cookie $http_cookie;   # necessário p/ cookie httpOnly do Better Auth
    }
}
```

> `www.useconfirma.com` (marketing) **não** tem server block aqui — aponta via CNAME/nameserver para a Vercel (seção 14.2), que cuida do próprio TLS e roteamento.

**CORS no `api`** (para a chamada vinda de `www.useconfirma.com` na Vercel, no endpoint `/v1/waitlist`):

```typescript
// apps/api/src/plugins/cors.ts
import cors from "@fastify/cors";

export default fp(async (fastify) => {
  fastify.register(cors, {
    origin: [process.env.CORS_ORIGIN!], // https://www.useconfirma.com
    credentials: false, // /v1/waitlist não usa cookie — não precisa
  });
});
```

### 14.4 Variáveis de ambiente (`apps/api/.env.example`)

```dotenv
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://confirma:senha@postgres:5432/confirma
REDIS_URL=redis://redis:6379
APP_ENCRYPTION_KEY=<32 bytes em hex>        # openssl rand -hex 32
POSTGRES_PASSWORD=<senha>

# Better Auth
BETTER_AUTH_SECRET=<gerar com openssl rand -hex 32>
BETTER_AUTH_URL=https://app.useconfirma.com
GOOGLE_CLIENT_ID=<...>
GOOGLE_CLIENT_SECRET=<...>

# Resend (Magic Link + e-mail de confirmação da waitlist)
RESEND_API_KEY=<...>
MAIL_FROM="Confirma <no-reply@useconfirma.com>"

# CORS — origem do form nativo de waitlist (marketing na Vercel)
CORS_ORIGIN=https://www.useconfirma.com

# Defaults de negócio
DEFAULT_OFFSETS=24h,3h
RETENTION_DAYS=90
RATE_LIMIT_PER_MINUTE=120
PROMOTION_WINDOW_HOURS=24

# Nota: NÃO há EVOLUTION_BASE_URL / EVOLUTION_API_KEY globais aqui —
# cada Organization cadastra sua própria instância (BYO) via painel.
```

### 14.5 Pipeline de deploy

**VPS (`api` + `painel`, via GitHub Actions — só dispara se `paths` filter bater):**
1. `pnpm install` (raiz do monorepo).
2. `pnpm turbo build` — compila `packages/contracts`, `apps/api`, `apps/painel` (Turborepo respeita a ordem de dependências).
3. `pnpm --filter api exec prisma migrate deploy`.
4. `docker compose build && docker compose up -d` (api + worker + promote-cron; Postgres/Redis).
5. Painel: `apps/painel/dist` já buildado é copiado/servido pelo Nginx (nenhum container).
6. Nginx recarregado; certbot renova TLS de `api.` e `app.`.

**Vercel (`marketing`):** automático — a própria integração Vercel↔GitHub builda e publica a cada push na `main`, sem passar pelo Actions. `turbo-ignore` decide se o build é necessário para aquele commit.

---

## 15. Estratégia de testes

- **Unitários:** `intent-parser`, `state-machine`, `hmac`, `crypto`, mapeamento de `errorCategory` no adapter Evolution.
- **Integração:** ingestão (idempotência, HMAC inválido → 403, schema inválido → 422); cron de promoção (job `PENDING` dentro/fora da janela); webhook de resposta → callback.
- **Contrato:** validar payloads de ingestão e callback contra os schemas do PRD.
- **Fila:** delayed job com fake timers; idempotência do `jobId` (`${appointmentId}:${offset}`) sob promoção concorrente.
- **BYO:** health-check e `configureWebhook` contra instância mockada, incluindo respostas de versões variadas (parser defensivo).
- **E2E (sandbox):** ciclo completo `received → pending → enqueued → sent → confirmed → callback recebido`.

---

## 16. Decisões técnicas

### Fechadas nesta versão
- **Monorepo (3 apps):** `api`, `painel`, `marketing` — isolamento de blast radius e separação de necessidades de SEO/SSR vs. painel autenticado.
- **Frontend do painel:** TanStack Router + Vite (SPA), estático via Nginx.
- **Marketing/Docs:** Next.js, por precisar de SEO/SSR/SSG.
- **Canal WhatsApp:** BYO-Instance — cliente cadastra sua própria Evolution API; Confirma nunca opera nem paga mensageria.
- **Agendamento:** duas camadas (Postgres frio + promoção para BullMQ na janela de 24h), com `jobId` idempotente `${appointmentId}:${offset}`.
- **Autenticação do painel:** Better Auth (Google OAuth + Magic Link); entidade de tenant renomeada de `Account` para `Organization`.
- **E-mail transacional:** Resend (Magic Link + confirmação de waitlist) — Nodemailer/SMTP genérico descartado.
- **Lista de espera:** formulário nativo em `apps/marketing` (Tally descartado); um único e-mail de confirmação por cadastro, sem broadcast de lançamento no MVP.
- **Deploy:** `api`/`painel` na VPS via GitHub Actions (SSH); `marketing` na Vercel via integração nativa; branch única `main` protegida, deploy automático em todo merge.

### Em aberto
- Janela exata de promoção (24h é o ponto de partida; pode precisar de ajuste conforme volume real de agendamentos de longo prazo).
- Suporte BYO a WhatsApp Cloud API oficial (Meta) como opção adicional (Fase 2).
- Estratégia de multi-organização por usuário no painel (seletor de conta ativa), caso um `User` pertença a mais de uma `Organization`.
- Se/quando fizer sentido notificar toda a waitlist no lançamento, a ferramenta será separada do fluxo transacional atual (ex.: Resend Broadcasts/Audiences) — decisão explicitamente adiada.

---

*Fim do documento.*
