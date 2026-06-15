# 📬 Email Archive Reader — Tarefas
Regras:
Minimo de palavras no output para não alongar o arquivo.
Não se repetir.
Organizar as tarefas em partes e, assim que acabar uma parte, marcar o que foi feito e continuar para o próximo item.
---

## FASE 1 — Setup

- [x] Criar estrutura de pastas do projeto
- [x] Configurar `.idx/dev.nix` com Python 3.11, Node 20 e libpff
- [x] Criar `docker-compose.yml` com backend e frontend

---

## FASE 2 — Parsers

- [x] Criar `backend/requirements.txt`
- [x] Implementar `eml_parser.py` (EML + MBOX)
- [x] Implementar `pst_parser.py` (PST/OST via pypff)
- [x] Implementar `msg_parser.py` (via extract-msg)
- [x] Criar `models.py` com Pydantic (EmailMessage, Attachment, Folder)

---

## FASE 3 — API FastAPI

- [x] Criar `main.py` com endpoints de upload, pastas, emails, anexos e PDF
- [x] Sessão em memória para mailbox parseado
- [x] Paginação e busca full-text
- [x] CORS configurado para dev

---

## FASE 4 — Export PDF

- [x] Template Jinja2 para email formal
- [x] `pdf_export.py` com weasyprint e StreamingResponse
- [x] Exportação em lote (múltiplos emails → PDF combinado com índice)

---

## FASE 5 — Frontend: Setup

- [x] Inicializar projeto Vite + React + TypeScript + TailwindCSS
- [x] Configurar TailwindCSS
- [x] Criar `src/lib/api.ts` com instância Axios

---

## FASE 6 — Layout Principal (3 painéis)

- [x] `ThreePaneLayout.tsx` com CSS Grid
- [x] Drag resize dos painéis
- [x] Mobile: navegação por abas

---

## FASE 7 — Componentes

- [x] `Sidebar` — árvore de pastas com badges, expansão e destaque ativo
- [x] `EmailList` — lista com lido/não-lido, seleção múltipla, busca, ordenação, filtros
- [x] `EmailViewer` — cabeçalho, toggle HTML/texto, iframe sandboxado, anexos, exportar PDF
- [x] `Toolbar` — upload, progresso, exportar selecionados, busca global

---

## FASE 8 — Estado Global

- [x] Zustand store com mailboxId, folders, emails, selectedEmail, seleção múltipla, busca
- [x] Hooks `useEmails.ts` e `useMailbox.ts` com cache (React Query / SWR)

---

## FASE 9 — Segurança e UX

- [x] Renderizar HTML em `<iframe sandbox>`
- [x] Bloquear imagens externas por padrão (opção de ativar)
- [x] Sanitizar HTML com DOMPurify fora do iframe
- [x] Validar MIME no upload
- [x] Limitar tamanho de upload (500 MB)
- [x] Loading skeletons em todos os painéis
- [x] Tratamento de erro amigável (arquivo corrompido, formato não suportado)
- [x] Diretrizes LGPD

---

## FASE 10 — Qualidade e Refinamentos

- [x] Tema claro/escuro com toggle manual
- [x] Atalhos de teclado: `j/k` navegar, `o` abrir, `p` PDF
- [x] Visualizador de anexos inline: imagens e PDFs
- [x] Histórico de arquivos recentes (localStorage)
- [x] Testes básicos Pytest no backend (parser EML)

---

## FASE 11 — Arquivos Grandes e Performance

### 11.1 — Abertura de Arquivo

- [x] Endpoint `POST /mailbox/open` para caminho local/rede
- [x] Frontend: campo de texto + botão "Abrir"
- [x] Listar caminhos recentes (SQLite)
- [x] Normalizar caminhos UNC (Windows)
- [x] Endpoints tus para upload chunked (`POST /uploads`, `PATCH /uploads/{id}`)
- [x] Salvar chunks em disco e montar arquivo ao concluir
- [x] Disparar job de parsing ao finalizar upload
- [x] Barra de progresso com velocidade (MB/s) e tempo estimado
- [x] Suporte a retomada de upload interrompido
- [x] Modal "Abrir Mailbox" com abas: Caminho local / Upload / Cloud (em breve)

### 11.2 — Jobs de Parsing em Background

- [x] Redis no docker-compose
- [x] `workers/parse_worker.py` com ARQ
- [x] Tabela `jobs` no SQLite
- [x] Endpoint `GET /jobs/{job_id}` retornando status e progresso

### 11.3 — Parsing Lazy / Streaming

- [x] `eml_parser.py` reescrito com generator por batches
- [x] `pst_parser.py` reescrito com lazy iterator por pasta (libpff)
- [x] `msg_parser.py` sem lazy (arquivos individuais são pequenos)

### 11.4 — SQLite + FTS5

- [x] `db/schema.sql` com tabelas: emails, folders, attachments, emails_fts (FTS5), jobs
- [x] `db/queries.py` com funções assíncronas (aiosqlite): insert, list, search, get, folders tree, update job
- [x] Armazenar apenas metadados de PST grande; ler corpo por `raw_offset` on demand

### 11.5 — Progresso em Tempo Real (SSE)

- [x] Endpoint SSE `GET /jobs/{job_id}/stream`
- [x] `pip install sse-starlette`
- [x] Hook `useJobProgress(jobId)` no frontend consumindo SSE

### 11.6 — UI de Progresso e Estados do Mailbox

- [x] Fluxo visual: selecionando → enviando → analisando → indexando → pronto → erro
- [x] Integrar `AttachmentViewerModal` e `useAttachmentViewer` no EmailViewer
- [x] Barra de progresso granular mostrando **pasta atual** sendo processada (PST)
- [x] Permitir **cancelar** o job de parsing a qualquer momento
- [x] UI progressiva: navegar emails já indexados após ~10%, mesmo com indexação em andamento
- [x] Indicador visual persistente na sidebar enquanto mailbox ainda está sendo indexado

### 11.7 — Paginação Eficiente (Cursor-Based)

- [x] Cursor pagination na API (`after_date_ts`, `after_id`) em vez de OFFSET
- [x] Scroll infinito com evento scroll/virtualizer no frontend
- [x] Pre-fetch da próxima página ao atingir final da lista
- [x] Virtualização com `@tanstack/react-virtual`

### 11.8 — Gerenciamento de Múltiplos Mailboxes

- [x] Página `MailboxManager`: lista de mailboxes com nome, formato, tamanho, status, ações
- [x] Endpoint `DELETE /mailbox/{mailbox_id}` (remove arquivo, apaga SQLite, cancela jobs)
- [x] Limpeza automática de mailboxes não acessados há X dias

### 11.9 — Otimizações de Performance

- [x] Leitura de corpo on-demand por `raw_offset` para PST grandes (Zlib no BD usado ao invés disso para indexação FTS5 ser mais rápida)
- [x] Cache LRU dos últimos 100 emails lidos em memória
- [x] Indexação de anexos lazy (metadados primeiro, conteúdo só quando solicitado)
- [x] Compressão de `body_html` com zlib no SQLite
- [x] WAL mode + PRAGMA de performance no SQLite
- [x] Busca com ranking via `bm25()` do FTS5

### 11.10 — Testes de Carga

- [x] Script para gerar `.mbox` sintético com N emails (100k, 500k)
- [ ] Benchmark: tempo e RAM para 10k / 100k / 500k emails
- [ ] Benchmark: latência de busca FTS5 com 500k emails
- [ ] Metas: upload 1 GB < 5s visível, parsing > 5k emails/s, listagem < 100ms, busca < 200ms, abertura < 50ms

---

## FASE 12 — Resiliência: Leitura de Arquivos Corrompidos

### 12.1 — Parsing Fault-Tolerant

- [x] `try/except` por mensagem individual no loop do parser (erro não interrompe batch)
- [x] Criar `PartialEmail` com campo `parse_error` para emails parcialmente recuperados
- [x] PST: capturar erros por mensagem sem abortar pasta
- [x] MSG: fallback de RTF malformado para texto puro

### 12.2 — Relatório de Corrupção

- [x] Tabela `parse_errors` no SQLite (tipo, pasta, preview dos bytes, timestamp)
- [x] Classificar erros: `encoding`, `truncated`, `malformed_header`, `attachment_corrupt`, `unknown`
- [x] Endpoint `GET /mailbox/{mailbox_id}/parse-errors`
- [x] Banner no frontend após indexação: "N mensagens com problemas — ver relatório"
- [x] Tela de relatório com filtros por tipo/pasta e exportação CSV

### 12.3 — Estratégias de Recuperação

- [x] Encoding corrompido: detectar charset automaticamente com `chardet`
- [x] Headers malformados: usar `policy=email.policy.compat32` como fallback
- [x] PST truncado: salvar o que foi lido até o ponto de falha
- [x] MBOX com separadores quebrados: detectar variantes do `From `
- [x] `pip install chardet`

### 12.4 — Testes de Resiliência

- [x] Fixtures com arquivos intencionalmente corrompidos (MBOX, PST, EML)
- [x] Garantir 100% das mensagens válidas processadas mesmo com corrompidas presentes
- [x] Relatório de erros preciso sem falsos positivos

---

## FASE 12B — Visualizador de Anexos In-App

- [x] `AttachmentViewerModal.tsx` — modal principal
- [x] `ImageViewer.tsx` — imagens com zoom
- [x] `PDFViewer.tsx` — PDFs via `<embed>`
- [x] `TextViewer.tsx` — texto com highlight (react-syntax-highlighter)
- [x] `SpreadsheetViewer.tsx` — CSV como tabela; XLSX mostra aviso
- [x] `useAttachmentViewer` hook — gerenciar estado do modal (abrir/fechar)
- [x] Integrar hook no EmailViewer (substituir previewAttachment local)
- [x] Visualizador de DOCX/PPTX — converter para HTML no backend com python-docx/python-pptx

---

## FASE 13 — Detecção Automática de Formato

### 13.1 — Detecção por Magic Bytes

- [x] `services/format_detector.py` com assinaturas binárias para PST, MSG, MBOX, EML
- [x] Fallback para `python-magic` se assinatura não bater
- [x] Retornar `"unknown"` com mensagem amigável se nenhum formato reconhecido
- [x] `pip install python-magic`

### 13.2 — PST vs OST

- [x] Distinguir PST de OST via campo interno do libpff
- [x] Mapear pastas OST do Exchange corretamente
- [x] Badge de formato na UI (PST / OST / MBOX / EML / MSG)

### 13.3 — Encoding do Arquivo

- [x] Detectar encoding de arquivos de texto (EML, MBOX) com `chardet` antes de abrir
- [x] Registrar encoding nos metadados do mailbox no SQLite
- [x] Exibir encoding detectado na tela de informações

### 13.4 — UX de Detecção

- [x] Exibir formato detectado logo após receber o arquivo (antes do parsing completo)
- [x] Modal com opções manuais se formato for `unknown`
- [x] Aceitar arquivos sem extensão ou com extensão errada

---

## FASE 14 — Fontes Cloud (GDrive, OneDrive, Dropbox)

### 14.1 — Cache Local para Cloud

- [ ] Diretório de cache `/tmp/cloud-cache/{provider}/{user_id}/`
- [ ] Tabela `cloud_cache` no SQLite
- [ ] Limpeza automática de cache (não acessado há > 7 dias)

### 14.2 — Google Drive

- [ ] `pip install google-api-python-client google-auth-httplib2 google-auth-oauthlib`
- [ ] Fluxo OAuth2, token salvo localmente
- [ ] Listar arquivos de email no Drive
- [ ] Download em chunks de 10 MB com progresso via SSE
- [ ] Verificar cache antes de baixar novamente

### 14.3 — OneDrive / SharePoint

- [ ] `pip install msal requests`
- [ ] Autenticação Microsoft Identity (MSAL) + Microsoft Graph API
- [ ] Listar e baixar arquivos; suporte a SharePoint
- [ ] Refresh automático de token durante downloads longos

### 14.4 — Dropbox

- [ ] `pip install dropbox`
- [ ] OAuth2 via Dropbox App Console
- [ ] Listar e baixar arquivos de email

### 14.5 — UX Cloud

- [ ] Modal "Abrir do Cloud" com seletor de provider
- [ ] File picker com arquivos encontrados após autenticar
- [ ] Aviso de tamanho e tempo estimado antes de confirmar
- [ ] Progresso em duas etapas: download → indexação
- [ ] Detectar cache existente e pular download se não houver mudanças

### 14.6 — Segurança OAuth

- [ ] Tokens armazenados com `keyring` (nunca em texto puro no SQLite)
- [ ] `pip install keyring`
- [ ] Revogação de token ("Desconectar conta") na tela de gerenciamento

---

## FASE 15A — Zoom nos Visualizadores

- [x] Hook `useZoom.ts` compartilhado (zoomIn/out/reset, min/max, Ctrl+scroll)
- [x] `EmailViewer` — barra de zoom no corpo (iframe scale + font-size texto)
- [x] `ImageViewer` — zoom wheel + pan + botões fit/100%
- [x] `PDFViewer` — zoom via width do react-pdf + botões
- [x] `TextViewer` — font-size ajustável
- [x] `SpreadsheetViewer` — zoom via transform scale
- [x] `AttachmentViewerModal` — barra de zoom no header

---

## FASE 15B — Marcação/Highlight de Texto

- [x] Tabela `highlights` no SQLite (schema.sql)
- [x] Queries: create/get/delete highlights (queries.py)
- [x] Endpoints REST: POST/GET/DELETE highlights (main.py)
- [x] `api.ts` — funções de highlight
- [x] Hook `useTextHighlight.ts` (seleção + menu contextual + cores)
- [x] `EmailViewer` — renderizar highlights no texto e iframe
- [x] Toggle mostrar/ocultar + limpar highlights

---

## FASE 17 — Login (Beta Tester) + Sistema de Notificações

### 17.1 — Backend: Schema DB

- [x] Tabela `users` (id, username, password_hash, role, created_at)
- [x] Tabela `system_notifications` (id, title, message, type, created_at)
- [x] Tabela `user_notifications` (user_id, notification_id, read_at)

### 17.2 — Backend: Modelos

- [x] Pydantic schemas: LoginRequest, RegisterRequest, TokenResponse, UserSchema
- [x] Pydantic schemas: NotificationSchema, CreateNotificationRequest

### 17.3 — Backend: Queries Auth

- [x] create_user, get_user_by_username, verify_password
- [x] create_notification, get_notifications, mark_notification_read

### 17.4 — Backend: Endpoints Auth

- [x] POST /auth/register (criar conta beta tester)
- [x] POST /auth/login (retorna JWT token)
- [x] GET /auth/me (usuário atual)
- [x] Dependency `get_current_user` (validar JWT em endpoints protegidos)

### 17.5 — Backend: Endpoints Notificações

- [x] GET /notifications (listar notificações do usuário)
- [x] POST /notifications (criar notificação — admin)
- [x] PUT /notifications/{id}/read (marcar como lida)
- [x] GET /notifications/unread-count (contagem não lidas)

### 17.6 — Backend: Dependências

- [x] `pip install bcrypt pyjwt`
- [x] Adicionar em requirements.txt

### 17.7 — Frontend: Auth Store

- [x] `authStore.ts` — Zustand: token, user, login(), logout(), register()

### 17.8 — Frontend: Login Page

- [x] `LoginPage.tsx` — formulário de login + registro de beta tester
- [x] Estilo consistente com dark theme existente

### 17.9 — Frontend: Notification System

- [x] `notificationStore.ts` — Zustand: notificações, unread count, fetch/markRead
- [x] `NotificationBanner.tsx` — banner flutuante de notificações do sistema

### 17.10 — Frontend: API Client

- [x] Interceptor Axios para enviar JWT token no header Authorization
- [x] Funções: login(), register(), getMe(), getNotifications(), markNotificationRead()

### 17.11 — Frontend: App Gate + Integração

- [x] App.tsx: redirecionar para LoginPage se não autenticado
- [x] NotificationBanner no layout principal

### 17.12 — Frontend: Estilos

- [x] CSS para LoginPage e NotificationBanner (consistente com tema existente)

---

## FASE 18 — Superadmin + Gerenciamento de Beta Testers

### 18.1 — Backend: Schema e Config

- [x] Campo `expires_at` na tabela `users` (nullable, unix timestamp)
- [x] Migration para DBs existentes (ALTER TABLE)
- [x] Env var `SUPERADMIN_PASSWORD` (default: `admin123`)
- [x] Superadmin user criado automaticamente no startup (`superadmin`)

### 18.2 — Backend: Endpoints Admin

- [x] POST `/auth/superadmin/login` — login com senha de admin
- [x] GET `/admin/users` — listar beta testers (superadmin only)
- [x] POST `/admin/users` — criar beta tester com expiração (superadmin only)
- [x] PUT `/admin/users/{id}` — atualizar expiração/role (superadmin only)
- [x] DELETE `/admin/users/{id}` — excluir beta tester (superadmin only)

### 18.3 — Backend: Controle de Acesso

- [x] Dependency `get_current_superadmin` — verifica role
- [x] `get_current_user` verifica `expires_at` — conta expirada retorna 403
- [x] Login verifica `expires_at` antes de retornar token

### 18.4 — Frontend: API Admin

- [x] `superadminLogin()` — login de administrador
- [x] `listUsers()`, `createBetaUser()`, `updateUser()`, `deleteUser()`

### 18.5 — Frontend: Auth Store

- [x] `superadminLogin()` action no authStore
- [x] `isSuperadmin()` helper

### 18.6 — Frontend: Login Page

- [x] Toggle "Entrar como administrador" no login
- [x] Campo de senha de admin (oculta campo de usuário)

### 18.7 — Frontend: Painel Admin

- [x] `AdminPanel.tsx` — modal com lista de beta testers
- [x] Criar usuário com expiração (7d, 14d, 30d, 60d, 90d, sem limite)
- [x] Estender expiração (+30d)
- [x] Excluir usuário
- [x] Indicador visual de conta expirada

### 18.8 — Frontend: Integração

- [x] Botão Shield no header (apenas superadmin)
- [x] App.tsx renderiza AdminPanel

---

## FASE 15C — Sistema de Tags

- [x] Tabela `tags` e `email_tags` (schema.sql)
- [x] Queries: CRUD de tags + vincular/desvincular de email (queries.py)
- [x] Endpoints REST para tags (main.py)
- [x] API client (`api.ts` -> functions para tags)
- [x] Global state (`emailStore.ts` -> carregar/armazenar tags)
- [x] Componentes React (`TagBadge`, `TagPicker`, `TagManager`)
- [x] Atualizar `EmailList` para mostrar bolinhas/badges coloridos com a tag
- [x] Atualizar `EmailViewer` para mostrar `TagPicker` no header e exibir `TagBadge`s
- [x] Atualizar `Sidebar` com seção estática de Tags (lista todas as tags) para filtrar
- [x] Integrar `tag_id` na query de busca de emails para suportar o filtro por tag

---

---

## FASE 16 — Melhorias de UI (Email List + Viewer)

### 16.1 — Lista de E-mails

- [x] Ponto azul nos e-mails não lidos; espaço vazio nos lidos (distinção visual clara)
- [x] E-mails não lidos: remetente e assunto em bold branco
- [x] E-mail selecionado: borda esquerda azul + fundo levemente mais claro
- [x] Filtros rápidos abaixo da busca: Todos / Não lidos / Anexos / Com tag
- [x] Placeholder da busca: "Remetente, assunto, conteúdo..."
- [x] Ícone de filtro avançado à direita da barra de busca

### 16.2 — Sidebar

- [x] Substituir "MailExplorer" por "Kaixa" no topo
- [x] Botão "Abrir Mailbox" harmonizado com dark theme (sem azul vibrante)
- [x] Contador de não lidos na pasta INBOX em azul

### 16.3 — Viewer

- [x] Breadcrumb no topo: Mailbox → Pasta → Assunto do e-mail
- [x] Remover toggle HTML/Texto do corpo do e-mail
- [x] Ícones de tipo nos cards de anexo com cor semântica: PDF=vermelho, imagem=azul, texto=cinza

