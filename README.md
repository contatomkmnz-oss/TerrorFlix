# DesenhosFlix — desenvolvimento local

Front-end do estilo streaming (Netflix-like) rodando **100% no navegador**, sem Base44, sem backend obrigatório e sem checkout real. Os dados do catálogo e preferências ficam em **localStorage** (modo demonstração).

## Requisitos

- Node.js 18+ (recomendado 20+)
- npm

## Instalação e execução

```bash
npm install
npm run dev
```

Abra `http://localhost:3000` (porta configurada em `vite.config.js` → `server.port`).

Build de produção (arquivos estáticos em `dist/`):

```bash
npm run build
npm run preview
```

## Onde editar conteúdo

| O quê | Onde |
|--------|------|
| Textos da marca, FAQ, depoimentos, mensagens de checkout demo | `src/data/siteContent.js` |
| Catálogo inicial (séries, episódios, banners, códigos demo) | `src/data/mockSeed.js` |
| Logo | `public/images/logo-desenhosflix.svg` e `brand.logoUrl` em `siteContent.js` |
| Planos e preços da página Assinatura | `subscriptionPlans` e `subscriptionPage` em `src/data/siteContent.js` |
| Comportamento demo / paywall | `src/config/demo.js` e variáveis `VITE_*` no `.env` (veja `.env.example`) |
| Implementação dos dados mock (API local) | `src/api/localMockClient.js` |
| Vídeos Bunny.net (Stream / CDN) | Guia em **`docs/bunny-net.md`** — URLs no campo `video_url` do episódio (admin) |

Imagens de capa dos títulos de exemplo usam URLs públicas (Unsplash) no seed; você pode trocar por arquivos em `public/images/` e apontar no `mockSeed.js`.

## Variáveis de ambiente

Copie `.env.example` para `.env` e ajuste se precisar:

- **`VITE_DEMO_MODE`** — mantém o fluxo pensado para desenvolvimento local (padrão implícito: ligado, a menos que defina `false`).
- **`VITE_DEMO_BYPASS_SUBSCRIPTION`** — quando `true` (padrão), o app não bloqueia com a tela de assinatura obrigatória; defina `false` para testar o **SubscriptionWall** como usuário sem plano.

## Integrações removidas ou substituídas

- **Base44** (`@base44/sdk`, plugin Vite, funções em `base44/`): removidos do pipeline de build. O cliente em `src/api/base44Client.js` aponta para o mock local.
- **API `/api/apps/public` e auth remota**: não são mais chamadas; o `AuthContext` carrega o usuário demo via mock.
- **AbacatePay / `createAbacatepayBilling`**: não gera cobrança real; o modal de checkout entra em **modo demonstração** e pode **simular assinatura ativa** só no navegador (localStorage).
- **Scripts de analytics / pixel (utmify)** removidos do `index.html`.
- **Favicon Base44** substituído pelo logo local.

## O que está mockado

- Entidades (séries, episódios, perfis, lista, histórico, códigos, propostas, etc.) via **localStorage**.
- Funções serverless (`ensureTrialSubscription`, `getMySubscription`, `cancelSubscription`, `deleteMyAccount`, etc.) com respostas locais.
- Upload / LLM no **Criar episódios por imagem** (admin): upload vira URL local; LLM devolve um episódio de exemplo.

## Resetar dados locais

No DevTools do navegador → Application → Local Storage → limpar o site, ou apague chaves que começam com `desenhosflix_mock_` e `desenhosflix_demo_subscription`.

## Estrutura útil

```
public/images/          # Logo e assets estáticos
src/
  api/                  # base44Client + localMockClient
  config/               # demo.js
  data/                 # siteContent.js, mockSeed.js
  components/           # UI e layout
  pages/                # Rotas
```

## Nota sobre o site de referência

O projeto nesta pasta já era o app **DesenhosFlix** (streaming). O site público [desenhoflixofc.com](https://desenhoflixofc.com/) pode incluir landing e rastreamento além deste repositório; aqui o foco é **preview estável e editável** com a mesma identidade visual (cores, layout tipo Netflix) e fluxos clicáveis.
