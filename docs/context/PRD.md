# PRD — Confirma (SaaS de Confirmação de Agenda para Clínicas)

> **Nome de trabalho:** Confirma _(provisório)_
> **Autor:** Arthur
> **Status:** Draft v0.4
> **Última atualização:** 2026-07-11
>
> **Changelog v0.4:**
>
> - Nomes de pastas dos apps atualizados: `apps/dashboard` → `apps/painel`, `apps/marketing-docs` → `apps/marketing`. App `apps/blog` removido do escopo do monorepo (não haverá blog no MVP nem em fases futuras definidas).
>
> **Changelog v0.3:**
>
> - Provedor de e-mail transacional definido: **Resend** (Magic Link do login e e-mail de confirmação da lista de espera).
> - Formulário de lista de espera passa a ser **nativo** (construído em `apps/marketing`), sem ferramenta externa (Tally descartado) — reduz dependência de terceiro e reforça percepção técnica junto ao público-alvo (devs).
> - Novo requisito de produto: captura de lista de espera com **um único e-mail de confirmação** ("acesso antecipado à documentação"), sem fluxo de notificação em massa no lançamento (fora de escopo do MVP).
>
> **Changelog v0.2** (sessão de refinamento de arquitetura/produto):
>
> - Modelo de integração WhatsApp redefinido para **BYO-Instance** (Bring Your Own Instance) — o cliente traz sua própria instância/token da Evolution API; o Confirma não fornece número nem paga mensageria. Isso muda o modelo de negócio (seção 13) e o perfil de risco (seção 15).
> - Autenticação do dashboard via **Better Auth** (Google OAuth + Magic Link), substituindo usuário/senha.
> - Agendamento em **duas camadas** (Postgres frio + Redis/BullMQ só na janela de curto prazo).
> - Estrutura de produto formalizada em **4 superfícies** (API, Dashboard, Marketing/Docs, Blog) — ver seção 5.3.
> - Renomeação da entidade de tenant de `Account` para `Organization` no modelo de dados, para não colidir com a entidade `Account` nativa do Better Auth (ver seção 10).

---

## 1. Resumo executivo

Confirma é uma **infraestrutura de confirmação de agenda** para clínicas e sistemas de saúde. O produto expõe um webhook público que qualquer sistema (ERP, prontuário, RIS, agenda) pode chamar para delegar a notificação e a confirmação de agendamentos com o paciente via WhatsApp.

O diferencial não é "enviar mensagem" — é **fechar o loop**: o paciente responde, o Confirma interpreta a resposta e faz um _callback_ de volta ao sistema de origem, mantendo a agenda sincronizada automaticamente. O produto se posiciona como redutor de **no-show (faltas)**, não como notificador genérico.

**Modelo de canal (BYO-Instance):** o Confirma não é um reseller de mensageria. O cliente traz sua própria instância de disparo (Evolution API própria, com URL e token) e cadastra as credenciais no painel. O Confirma orquestra — fila, timing, interpretação de resposta, sincronização — e nunca incorre em custo de mensagem. Isso simplifica o modelo de negócio e remove o Confirma da cadeia de responsabilidade sobre o canal de disparo em si.

**Público-alvo primário:** software houses e desenvolvedores que já constroem sistemas para clínicas e querem oferecer confirmação automática sem construir fila, retry, gestão de templates e compliance LGPD.

**Modelo de receita:** assinatura por volume de agendamentos processados (orquestração), com opção white-label para integradores. Ver seção 13.

---

## 2. Problema e oportunidade

- Clínicas no Brasil perdem tipicamente **20–30% da agenda** com faltas; cada slot vazio é receita não recuperável.
- A confirmação manual (recepcionista ligando) é cara, inconsistente e não escala.
- Construir confirmação por conta própria exige: fila com agendamento preciso, lógica de retry, parsing de respostas, compliance LGPD de dado sensível de saúde, e integração resiliente com um canal de disparo que o próprio cliente já opera ou pretende operar. É trabalho repetido que ninguém quer fazer.
- No modelo BYO-Instance, quem já usa (ou vai subir) uma instância de WhatsApp não precisa negociar aprovação de BSP com o Confirma — só aponta a própria instância. Isso reduz a fricção de adoção e o tempo de onboarding.

**Oportunidade:** ser a camada de **orquestração** ("Stripe da confirmação de agenda") que integradores plugam via um único POST, sem que o Confirma precise mexer em custo, risco ou compliance de mensageria — isso é do cliente.

---

## 3. Objetivos e métricas de sucesso

### Objetivos de produto

- O1: Um dev integra e envia a primeira confirmação em **menos de 30 minutos** de leitura da doc.
- O2: Reduzir a taxa de no-show das clínicas atendidas em pelo menos **X pontos percentuais** (baseline medido por conta).
- O3: Sincronizar automaticamente o status da agenda de origem sem intervenção humana.
- O4: Onboarding de uma instância BYO (Evolution) funcionando de ponta a ponta sem suporte manual.

### KPIs

| KPI                            | Definição                                                                        | Meta inicial                |
| ------------------------------ | -------------------------------------------------------------------------------- | --------------------------- |
| Taxa de confirmação            | % de agendamentos com resposta do paciente                                       | > 60%                       |
| Taxa de no-show evitado        | Faltas antes vs. depois                                                          | mensurável por conta        |
| Latência de entrega            | Recebimento do webhook → envio agendado                                          | conforme offset configurado |
| Taxa de callback com sucesso   | Callbacks entregues ao sistema de origem                                         | > 99%                       |
| Time-to-first-message (dev)    | Cadastro → primeira mensagem enviada                                             | < 30 min                    |
| Taxa de setup BYO bem-sucedido | Contas que conectam a instância própria sem suporte manual                       | > 80%                       |
| Atribuição correta de falha    | % de falhas de envio corretamente atribuídas (instância do cliente vs. Confirma) | > 95%                       |

---

## 4. Personas

- **Dev integrador (usuário primário):** desenvolvedor de uma software house de saúde. Quer contrato de API claro, idempotência, ambiente de sandbox e callback confiável. Já opera (ou vai operar) sua própria instância de WhatsApp.
- **Gestor da clínica (comprador/beneficiário):** enxerga ROI (faltas evitadas). Precisa de um painel simples com métricas, login sem fricção (Google/Magic Link).
- **Paciente (destinatário):** recebe o lembrete e responde. Experiência precisa ser clara e sem fricção (responder 1/2/3).

---

## 5. Escopo

### 5.1 Dentro do escopo (MVP)

- Webhook público de ingestão de agendamentos com autenticação e idempotência.
- Agendador em duas camadas que dispara lembretes em offsets configuráveis antes do exame.
- Envio via WhatsApp usando a **instância própria do cliente (BYO)** — adapter Evolution API.
- Auto-configuração do webhook de resposta na instância do cliente, com fallback manual documentado.
- Atribuição clara de falhas (instância do cliente vs. falha interna do Confirma).
- Recebimento e interpretação da resposta do paciente (confirmar / cancelar / remarcar).
- Callback de volta ao sistema de origem.
- Painel mínimo com métricas de confirmação e no-show.
- Login do painel via **Google OAuth** ou **Magic Link** (sem senha).
- Gestão de API keys (de integração, distintas do login humano) por conta.
- Landing page institucional e documentação técnica self-service para o dev integrador.

### 5.2 Fora do escopo (MVP — considerar em v2+)

- Escalonamento multicanal (WhatsApp → SMS → ligação).
- Self-service de criação/aprovação de templates.
- Suporte a WhatsApp Cloud API oficial (Meta) como opção BYO adicional além da Evolution.
- Fallback automático entre múltiplas instâncias/providers do mesmo cliente.
- Tiers de volume e billing automatizado.
- Remarcação interativa com escolha de novo horário dentro do chat.
- Multi-idioma.

### 5.3 Superfícies do produto

O produto é composto por três superfícies independentes (detalhamento técnico em `TECH_SPECS.md`):

| Superfície           | Público                             | Propósito                                                                    |
| -------------------- | ----------------------------------- | ---------------------------------------------------------------------------- |
| **API**              | Dev integrador                      | Núcleo do produto: ingestão, orquestração, callback                          |
| **Painel**           | Gestor da clínica / dev             | Painel autenticado: métricas, API keys, config BYO                           |
| **Marketing & Docs** | Visitante / dev avaliando o produto | Landing page de conversão + documentação técnica pública (SEO institucional) |

O isolamento entre essas superfícies existe para: (a) permitir SEO adequado nas páginas públicas sem acoplar ao painel autenticado; (b) isolar o "blast radius" de falhas — uma instabilidade na landing page não deve afetar o painel nem a API; (c) manter o painel leve e barato de operar (estático, sem servidor Node dedicado).

**Pré-lançamento:** a landing page de `marketing` inclui um formulário de lista de espera **nativo** (sem ferramenta externa), que envia diretamente para `POST /v1/appointments`-sibling `POST /v1/waitlist` na API. Cada cadastro recebe um único e-mail transacional de confirmação ("acesso antecipado à documentação"), via Resend. Não há, no MVP, notificação em massa a todos os inscritos no momento do lançamento — se isso vier a existir, é decisão de fase futura, fora do escopo atual.

---

## 6. Requisitos funcionais

### Ingestão

- **RF-01** — O sistema deve expor `POST /v1/appointments` para receber agendamentos de sistemas externos.
- **RF-02** — Cada requisição deve ser autenticada por API key enviada em header (`X-Api-Key`), nunca no corpo.
- **RF-03** — Cada requisição deve ser validada por assinatura HMAC-SHA256 do payload (`X-Signature`), com a chave secreta da conta.
- **RF-04** — O sistema deve garantir idempotência via header `Idempotency-Key` (ou hash derivado de `externalId + datetime`), evitando notificação duplicada.
- **RF-05** — O sistema deve validar o schema do payload e retornar `422` com detalhes em caso de erro, sem enfileirar.
- **RF-06** — O sistema deve aplicar rate limiting por conta para conter abuso da rota pública.

### Agendamento e envio (duas camadas)

- **RF-07** — Na ingestão, o sistema deve persistir o `NotificationJob` no Postgres com status `PENDING`, sem enfileirar no Redis imediatamente.
- **RF-08** — Um processo periódico (cron, ex.: a cada 1h) deve varrer jobs `PENDING` cujo disparo esteja dentro da janela de curto prazo (ex.: 24h) e promovê-los para `ENQUEUED`, materializando-os no BullMQ com o delay exato restante.
- **RF-09** — O sistema deve suportar múltiplos lembretes por agendamento (ex.: 24h antes e follow-up 3h antes se ainda sem resposta).
- **RF-10** — Cancelamentos solicitados antes da promoção para o Redis devem ser tratados como operação direta no Postgres (update/delete), sem necessidade de tocar o Redis.
- **RF-11** — O envio deve ocorrer através de uma interface de provider (adapter), desacoplada do provider concreto.
- **RF-12** — O sistema deve registrar cada tentativa de envio (log de mensagem) com status, identificador do provider e **categoria do erro** (instância do cliente vs. falha interna).
- **RF-13** — Em falha de envio, o sistema deve aplicar retry com backoff e marcar `failed` após esgotar tentativas.

### Integração BYO-Instance

- **RF-14** — O cliente deve poder cadastrar no painel a URL e o token da própria instância Evolution API.
- **RF-15** — Ao salvar as credenciais, o sistema deve tentar configurar programaticamente o webhook de resposta na instância do cliente; se falhar, deve orientar a configuração manual.
- **RF-16** — O sistema deve oferecer um teste de conexão (health-check) contra a instância cadastrada, exibindo o resultado no painel.
- **RF-17** — O adapter deve tolerar variações de versão da Evolution API do cliente, sem quebrar o parse do JSON de resposta.

### Resposta e confirmação

- **RF-18** — O sistema deve receber respostas do paciente via webhook do provider e associá-las ao agendamento correto.
- **RF-19** — O sistema deve interpretar a intenção da resposta (confirmar / cancelar / remarcar) a partir de opções numéricas (1/2/3) e/ou palavras-chave.
- **RF-20** — Respostas ambíguas devem gerar uma mensagem de re-pergunta dentro da janela de atendimento gratuita.
- **RF-21** — O sistema deve atualizar o status do agendamento conforme a máquina de estados (seção 9).

### Callback (loop bidirecional)

- **RF-22** — Ao mudar de estado relevante, o sistema deve emitir `POST` de callback para a URL configurada (por conta ou por requisição).
- **RF-23** — O callback deve ser assinado com HMAC para o receptor validar autenticidade.
- **RF-24** — O sistema deve aplicar retry com backoff em callbacks que falharem e registrar cada tentativa.

### Autenticação e gestão

- **RF-25** — O login do painel deve ocorrer exclusivamente via **Google OAuth** ou **Magic Link** (e-mail com link temporário) — sem senha.
- **RF-26** — Sessões do painel devem ser gerenciadas via cookies seguros `httpOnly`.
- **RF-27** — Cada conta deve poder gerar, rotacionar e revogar **API keys de integração**, mecanismo distinto do login humano.
- **RF-28** — O painel deve exibir taxa de confirmação, faltas evitadas e volume de mensagens por período.
- **RF-29** — O painel deve exibir alertas visuais claros quando uma falha de envio for atribuída à instância do cliente, para reduzir chamados de suporte indevidos.
- **RF-30** — Deve haver ambiente de **sandbox** com envio simulado (sem tocar a instância real) para o dev testar a integração.
- **RF-31** — Templates de mensagem devem ser configuráveis por conta, mantidos estritamente transacionais (utility), já que o custo/categoria da mensagem é responsabilidade da conta do cliente.

### Lista de espera (pré-lançamento)

- **RF-32** — O site institucional (`marketing`) deve expor um formulário nativo de lista de espera, sem depender de ferramenta externa de formulários.
- **RF-33** — O envio do formulário deve chamar `POST /v1/waitlist` na API, validado por schema compartilhado (`packages/contracts`) e protegido por rate limit por IP e por um campo honeypot (anti-spam, sem captcha).
- **RF-34** — Ao cadastrar, o sistema deve enviar automaticamente **um único e-mail transacional** de confirmação informando que o lead garantiu acesso antecipado à documentação.
- **RF-35** — Cadastros duplicados (mesmo e-mail) devem ser tratados via upsert, sem gerar novo disparo de e-mail nem erro para o usuário.

---

## 7. Requisitos não-funcionais

### Segurança

- **RNF-01** — Toda comunicação deve ocorrer sobre HTTPS/TLS.
- **RNF-02** — Secrets (chaves de API de integração, tokens de instância BYO) devem ser armazenados criptografados (AES-256-GCM) e nunca em texto plano em logs.
- **RNF-03** — Payloads de entrada e de callback devem ser assinados por HMAC.
- **RNF-04** — Dados pessoais não devem trafegar em query string/URL.
- **RNF-05** — Sessões de login devem usar cookies `httpOnly` emitidos pelo provedor de autenticação (Better Auth), nunca token em `localStorage`.

### LGPD e dados sensíveis

- **RNF-06** — Nome do paciente + tipo de exame constituem **dado sensível de saúde**; aplicar minimização de dados (armazenar o mínimo necessário).
- **RNF-07** — Aplicar TTL: apagar/anonimizar dados do paciente após a conclusão do exame + período legal mínimo.
- **RNF-08** — Criptografia em repouso para dados de paciente e para credenciais BYO.
- **RNF-09** — O Confirma atua como **operador** (não controlador) dos dados do paciente; deve haver DPA com cada conta integradora definindo responsabilidades. O Confirma **não tem responsabilidade sobre o canal de disparo em si**, que pertence ao cliente.
- **RNF-10** — Registrar base legal de tratamento e suportar solicitações de exclusão.

### Disponibilidade e desempenho

- **RNF-11** — A rota de ingestão deve responder rápido e apenas persistir no Postgres (Camada 1); a materialização em fila é responsabilidade do cron de promoção (Camada 2).
- **RNF-12** — O cron de promoção deve garantir que todo `NotificationJob` dentro da janela de curto prazo seja materializado no Redis antes do horário de disparo.
- **RNF-13** — O `jobId` do BullMQ deve seguir o padrão `${appointmentId}:${offset}` para blindar contra duplicidade em caso de concorrência ou restart do cron.
- **RNF-14** — Callbacks e envios devem ser processados por workers escaláveis horizontalmente.
- **RNF-15** — O sistema deve ser multi-tenant, isolando dados por `Organization`.

### Observabilidade

- **RNF-16** — Logs estruturados por agendamento (trilha completa: ingestão → promoção → envio → resposta → callback).
- **RNF-17** — Métricas e alertas para falhas de envio (com categoria) e de callback.

---

## 8. Contrato de API

### 8.1 Ingestão — `POST /v1/appointments`

**Headers**

```
X-Api-Key: <chave pública da conta>
X-Signature: <HMAC-SHA256 do corpo, com o secret da conta>
Idempotency-Key: <uuid do sistema de origem>
Content-Type: application/json
```

**Body**

```json
{
    "externalId": "agd_9931",
    "patient": {
        "name": "Maria Silva",
        "phone": "+5521999998888"
    },
    "appointment": {
        "type": "Ressonância Magnética de Crânio",
        "datetime": "2026-07-10T14:30:00-03:00",
        "location": "Unidade Centro",
        "professional": "Dr. João Souza"
    },
    "notification": {
        "channels": ["whatsapp"],
        "reminderOffsets": ["24h", "3h"]
    },
    "callbackUrl": "https://sistema-origem.com.br/webhooks/confirma"
}
```

> Nota: o payload de ingestão não muda com o BYO-Instance — a instância de disparo é resolvida internamente a partir da `Organization` autenticada pela API key, não pelo payload.

**Respostas**

- `202 Accepted` — agendamento aceito e persistido (status `RECEIVED`, `NotificationJob` em `PENDING`). Retorna `appointmentId` interno.
- `200 OK` — idempotência: requisição já processada (retorna o mesmo `appointmentId`).
- `401` — API key inválida. `403` — assinatura inválida.
- `422` — payload inválido (detalha campos).
- `429` — rate limit excedido.

### 8.2 Callback — `POST <callbackUrl>`

Enviado pelo Confirma ao sistema de origem em mudanças de estado.

**Headers**

```
X-Confirma-Signature: <HMAC-SHA256 do corpo>
```

**Body**

```json
{
    "event": "appointment.confirmed",
    "appointmentId": "cfm_a1b2c3",
    "externalId": "agd_9931",
    "status": "confirmed",
    "respondedAt": "2026-07-09T16:02:11-03:00",
    "raw": { "reply": "1" }
}
```

**Eventos:** `appointment.confirmed`, `appointment.cancelled`, `appointment.reschedule_requested`, `appointment.no_response`, `appointment.delivery_failed`.

Quando `appointment.delivery_failed` é emitido, o campo `raw.errorCategory` indica se a falha se originou na **instância do cliente** (`client_instance_error`) ou internamente (`confirma_internal_error`), para que o sistema de origem também consiga direcionar o alerta corretamente.

O receptor deve responder `2xx`; caso contrário, o Confirma aplica retry com backoff.

---

## 9. Máquina de estados do agendamento

```
received → pending → enqueued → sent → awaiting_response
                                            ├─→ confirmed
                                            ├─→ cancelled
                                            ├─→ reschedule_requested
                                            └─→ no_response (expirou sem resposta)

pending  → cancelled (cancelamento direto no Postgres, antes da promoção — RF-10)
enqueued/sent → delivery_failed (falha de envio após retries, com categoria de erro)
```

- `received`: payload validado e persistido.
- `pending`: `NotificationJob` aguardando no Postgres (Camada 1), fora do Redis.
- `enqueued`: promovido pelo cron para o BullMQ, dentro da janela de curto prazo (Camada 2).
- `sent`: mensagem entregue à instância do cliente.
- `awaiting_response`: aguardando resposta do paciente dentro da janela.
- Estados terminais disparam callback (RF-22).

---

## 10. Modelo de dados (entidades principais)

> **Nota de nomenclatura:** a entidade de tenant, antes chamada `Account`, foi renomeada para **`Organization`** para não colidir com a entidade `Account` nativa do Better Auth (que representa uma identidade de login vinculada, ex. conta Google). Ver `TECH_SPECS.md` §4 para o schema completo, incluindo as entidades nativas do Better Auth (`User`, `Session`, `Account`, `Verification`).

- **Organization** — tenant/cliente do SaaS (software house ou clínica). Configurações padrão de offsets, callbackUrl, e **credenciais BYO da instância WhatsApp** (`providerConfig`, criptografado).
- **ApiKey** — chave pública + secret (para HMAC) de **integração**, associadas à `Organization`; suporta rotação/revogação. Distinta do login humano.
- **User / Session / Account / Verification** — entidades nativas do Better Auth para login do painel (Google OAuth / Magic Link).
- **Appointment** — dados do agendamento, paciente (minimizado), estado atual, offsets, callbackUrl efetiva.
- **NotificationJob** — job em duas camadas (`PENDING` no Postgres → `ENQUEUED` no BullMQ), qual offset, status.
- **MessageLog** — cada tentativa de envio: provider, id externo da mensagem, status, **categoria do erro** (cliente vs. interno), timestamps.
- **InboundEvent** — respostas recebidas do provider, brutas + intenção interpretada.
- **CallbackLog** — tentativas de callback ao sistema de origem, com status e retries.
- **Template** — templates transacionais por conta (categoria utility).
- **WaitlistLead** — cadastro de lista de espera (nome, e-mail, contexto de integração), independente do modelo multi-tenant de `Organization` — existe antes de qualquer conta ser criada.

---

## 11. Fluxo principal (end-to-end)

1. Sistema de origem chama `POST /v1/appointments` com um novo agendamento.
2. Confirma valida API key, HMAC e idempotência; persiste (`received`) e cria `NotificationJob` em `pending` no Postgres — nada vai ao Redis ainda.
3. O cron de promoção (Camada 2) detecta o job dentro da janela de curto prazo e o materializa no BullMQ (`enqueued`).
4. No offset configurado, o worker envia o template de lembrete via **instância BYO do cliente** (`sent`, `awaiting_response`).
5. Paciente responde no WhatsApp; a resposta abre a janela de atendimento de 24h (respostas subsequentes gratuitas do lado do provider do cliente).
6. Confirma interpreta a resposta e atualiza o estado (`confirmed`/`cancelled`/`reschedule_requested`).
7. Confirma emite callback assinado ao sistema de origem, que atualiza a agenda automaticamente.
8. Se não houver resposta, dispara-se o follow-up; esgotado o prazo → `no_response` + callback.
9. Se a instância do cliente falhar no envio (ex.: `401`, `ECONNREFUSED`), o Confirma registra a categoria do erro e sinaliza no painel que a falha é do lado do cliente.

---

## 12. Integração — canal de disparo WhatsApp (BYO-Instance)

- O Confirma **não fornece** número, instância ou aprovação de BSP. O cliente traz sua própria instância Evolution API (URL + token), cadastrada no painel.
- As credenciais são persistidas criptografadas (AES-256-GCM) em `Organization.providerConfig`.
- Ao salvar, o Confirma tenta configurar programaticamente o webhook de resposta na instância do cliente; se a tentativa falhar, o painel orienta a configuração manual.
- O adapter deve tolerar variações de versão do software Evolution rodando no lado do cliente, evitando quebras de parse.
- Falhas de conexão com a instância do cliente (`401`, `ECONNREFUSED`, timeout) são explicitamente atribuídas a ela nos logs e no painel — para não gerar falso chamado de suporte contra o Confirma.
- **Fora do escopo do MVP:** suporte a WhatsApp Cloud API oficial (Meta) como opção BYO adicional; fallback entre múltiplas instâncias do mesmo cliente.

**Nota de custo/risco:** como o cliente é dono do canal, o risco de reclassificação de template (utility → marketing) e o risco de ban por uso de protocolo não-oficial são **do cliente**, não do Confirma. O Confirma deve, ainda assim, orientar boas práticas (templates transacionais) na documentação, pois um canal banido do cliente gera percepção de falha do produto mesmo sem ser responsabilidade técnica do Confirma.

---

## 13. Modelo de negócio (resumo)

Com o modelo BYO-Instance, o Confirma **não incorre em custo de mensageria** — o COGS de WhatsApp é zero, pago diretamente pelo cliente à sua própria instância/BSP. O que se cobra é a **orquestração**: fila com timing preciso, retry, parsing de intenção, callback, sincronização de agenda e compliance LGPD.

- **Assinatura por volume de agendamentos processados:** faixas mensais por volume (ex.: até 500/1.000/5.000 agendamentos por mês). Sem custo de mensageria repassado, a margem bruta tende a >90%, limitada só por infraestrutura de fila/compute.
- **White-label para integradores (software houses):** fee mensal + tiers de volume; menor ticket unitário, maior volume agregado por integração.
- **Fora do escopo do MVP:** cobrança por confirmação individual (usage-based per-message) — fazia sentido no modelo anterior de repasse de mensageria; no modelo BYO, a métrica de cobrança mais natural é volume de agendamentos orquestrados, não mensagens.

Posicionamento de venda: **recuperação de receita perdida com faltas** e **eliminação do trabalho de manter fila/retry/compliance**, não "envio de mensagens".

---

## 14. Roadmap

### Fase 1 — MVP

Ingestão com auth/HMAC/idempotência; agendamento em duas camadas (Postgres frio + promoção para BullMQ); cadastro BYO de instância Evolution com auto-configuração de webhook e teste de conexão; recebimento e parse de resposta (1/2/3); atribuição clara de erros; **callback de volta**; painel mínimo de métricas; login via Google OAuth/Magic Link; sandbox; landing page + docs públicas; formulário nativo de lista de espera com confirmação por e-mail (Resend).

### Fase 2

Suporte BYO a WhatsApp Cloud API oficial (Meta) como opção adicional; follow-ups e regras de escalonamento; self-service de templates; billing e tiers de volume.

### Fase 3

Escalonamento multicanal (WhatsApp → SMS → ligação); remarcação interativa dentro do chat; fallback automático entre instâncias/providers do cliente; relatórios avançados de ROI.

---

## 15. Riscos e mitigações

| Risco                                                                            | Impacto                                                                | Mitigação                                                                                                      |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Instância BYO do cliente mal configurada ou fora do ar                           | Falha de envio percebida como bug do Confirma                          | Categorização explícita do erro; teste de conexão no cadastro; alertas visuais claros no painel (RF-16, RF-29) |
| Reclassificação de template (utility → marketing) ou ban da instância do cliente | Percepção de falha do produto, mesmo sendo responsabilidade do cliente | Documentação de boas práticas; deixar claro no contrato/DPA que o canal é de responsabilidade do cliente       |
| Variação de versão da Evolution API do cliente quebrando o parse                 | Falha silenciosa de envio ou de recebimento de resposta                | Adapter tolerante a variações de schema; testes contra múltiplas versões conhecidas                            |
| Falha na auto-configuração do webhook na instância do cliente                    | Cliente não recebe respostas automaticamente                           | Fallback com instruções manuais claras + teste de conexão que valida o webhook configurado                     |
| Abuso da rota pública (agendamentos falsos)                                      | Custo de infraestrutura e ruído no painel do cliente                   | HMAC + rate limit + idempotência + validação                                                                   |
| Vazamento de dado sensível de saúde ou de credenciais BYO                        | Sanção LGPD, dano reputacional                                         | Criptografia (AES-256-GCM), minimização, TTL, DPA, logs sem PII                                                |
| Callback do cliente indisponível                                                 | Dessincronização de agenda                                             | Retry com backoff + fila de callbacks + alerta                                                                 |
| Comprometimento de conta de login (Google/Magic Link)                            | Acesso indevido ao painel                                              | Cookies httpOnly, expiração de sessão, links mágicos de uso único e com TTL curto                              |

---

## 16. Perguntas em aberto

- Nome definitivo do produto e domínio.
- Política de retenção exata (prazo legal a validar para dado de saúde).
- Estrutura de opt-in do paciente: quem coleta o consentimento — o Confirma ou o sistema de origem?
- Definir baseline de no-show por conta para provar ROI.
- Faixas de preço da assinatura por volume de agendamentos (a validar com early adopters).
- Domínio(s) e estratégia de conteúdo para `marketing`.

---

_Fim do documento._
