# Super7 Digital

Loja online das lojas de conveniência Super7 dos postos Pumangol, com back-office para a equipa.
Nesta primeira fase a página inicial está centrada na **campanha de Natal** (cestas Ouro, Prata e Bronze
para clientes e colaboradores) e na **campanha de escoamento**.

React 19 · TypeScript · Vite · React Router · TanStack Query · Axios. Liga-se à Pumangol Marketplace API
(ver `docs/openapi.yaml` no repositório da API).

## Executar

```bash
npm install
cp .env.example .env      # URL da API em VITE_API_URL; funcionalidades novas da API em api_features
npm run dev               # http://localhost:4200
npm run build             # verificação de tipos + build de produção em dist/ (falha sem VITE_API_URL)
npm run lint
```

## Publicação (Vercel)

A Vercel publica directamente do GitHub (`PUMANGOL/super7-web`): cada push para `main` vai para produção;
as outras branches e os pull requests ficam num endereço de pré-visualização.

1. Na Vercel, **Add New → Project** e importar `PUMANGOL/super7-web`. A app da Vercel no GitHub tem de ter
   acesso à organização PUMANGOL.
2. **Project Name: `super7digital`.** A API só aceita pedidos (CORS) de `https://super7digital.vercel.app`;
   com outro nome a loja abre, mas sem dados.
3. Framework, comando (`npm run build`) e pasta (`dist`) são detectados (`vercel.json` fixa o Vite).
   Node.js 22 ou mais recente.
4. **Settings → Environment Variables**, no ambiente Production (e em Preview, se se quiserem pré-visualizações):

   | Variável | Valor |
   | --- | --- |
   | `VITE_API_URL` | `https://portal.pumangol.co.ao/api/book-store` |
   | `api_features` | `campaigns,checkout-options,order-tracking,order-fields` |

   Os valores ficam fixos no build: depois de os mudar, é preciso publicar de novo (**Redeploy**).

O `vercel.json` serve `index.html` em todas as rotas (React Router), excepto em `/assets/`. Os ficheiros com
hash ficam aí, com cache de um ano, e um ficheiro em falta dá 404 em vez de devolver o HTML.

Do lado da API (equipa do backend):

- `APP_CORS_ALLOWED_ORIGINS` já inclui `https://super7digital.vercel.app`. As pré-visualizações
  (`super7digital-git-….vercel.app`) e um domínio próprio, se vier a existir, têm de ser acrescentados.
- `app.order.tracking-url` deve apontar para `https://super7digital.vercel.app/encomenda/{id}` (o link dos e-mails).

## Estrutura

```
src/
├── config/store.ts          # Campanhas (datas, textos), convenção de atributos, limites do checkout
├── catalog/                 # Domínio da loja: tipos, leitura dos atributos, filtros, checkout, encomendas locais
├── api/                     # Um módulo por recurso da API (products, orders, categories, …)
├── context/                 # Sessão (auth), carrinho, avisos da loja (notice) e do back-office (toast)
├── hooks/                   # Carrinho, catálogo, mutações do back-office
├── components/store/        # Layout e componentes da loja (classes s7-*)
├── components/backoffice/   # Layout e componentes do back-office
├── pages/store/             # Início, catálogo, produto, carrinho, checkout, encomenda
├── pages/backoffice/        # Encomendas, produtos, livros, categorias, lojas de levantamento
└── assets/
    ├── css/super7.css       # Folha de estilos do layout (não editar à mão: vem do design)
    ├── css/super7-app.css   # Complementos da aplicação (carregamento, estados, ajustes)
    ├── css/super7-ajustes.css # Responsividade (320 px a ecrãs largos) e movimento; carregado por último
    ├── fonts/, img/         # Montserrat e Figtree (loja) e Outfit (back-office) alojadas no projecto;
                             # logótipos oficiais do Super7 (cor e branco), cestas e fotografias das lojas
```

O back-office é carregado à parte (`React.lazy`): quem visita a loja não descarrega esse código.

## Rotas

| Rota | Página |
| --- | --- |
| `/` | Página inicial (campanha de Natal e escoamento) |
| `/catalogo?campanha=&categoria=&q=&precoMax=&emStock=1&ordenar=&pagina=` | Catálogo com filtros na URL |
| `/produto/:id` | Detalhe do produto ou cesta |
| `/carrinho`, `/checkout` | Carrinho e finalizar compra |
| `/encomenda/:id` | Confirmação e estado (é o link dos e-mails da API) |
| `/encomenda` | Consultar encomenda |
| `/login`, `/backoffice/*` | Área reservada à equipa |

## Catálogo

A API só filtra produtos por categoria e tipo. A loja carrega o catálogo completo uma vez
(`GET /product/list`, em cache no Redis) e faz no browser a pesquisa (sem acentos), os filtros, a ordenação
e a paginação. Quando o catálogo crescer para milhares de produtos, isto deve passar para a API.

Os livros também são produtos na API, mas o stock deles não é controlado. A loja pede `GET /book` para os
reconhecer: um livro nunca aparece como esgotado e mostra o autor como formato.

## Funções à espera da API

O frontend implementa todas as funções do layout, incluindo as que a API ainda não suporta. Os campos e
endpoints em falta estão descritos para o backend em **[docs/api-campos-em-falta.md](docs/api-campos-em-falta.md)**.

- Os campos novos já seguem nos pedidos (a API actual ignora-os) e são lidos das respostas assim que existirem.
- Os endpoints novos activam-se na variável de ambiente `api_features`, à medida que o backend os publicar:
  `campaigns`, `checkout-options`, `order-tracking`, `order-fields`, `backoffice-theme`, `role-permissions` (ver
  `src/config/store.ts`).
- Até lá, as campanhas vêm de `CAMPAIGNS` e as opções do checkout (taxa e zonas de entrega, métodos de
  pagamento) de `DEFAULT_CHECKOUT_OPTIONS`, ambos em `src/config/store.ts`.

## Campanhas e atributos dos produtos

Enquanto não existir `GET /campaign`, as **datas e textos** das campanhas estão em `src/config/store.ts`
(`CAMPAIGNS`): para mudar o prazo das encomendas de Natal (a contagem decrescente) ou terminar uma campanha,
basta alterar esse ficheiro. Fora das datas, a campanha deixa de aparecer no menu, na faixa e na página inicial.

A **ligação produto ↔ campanha** faz-se com os atributos livres do produto (`attributes`). O back-office
(Produtos → Novo/Editar) grava-os automaticamente, junto com os campos próprios propostos para a API (o frontend
lê primeiro esses campos e só depois os atributos). A tabela serve para quem os criar por outra via:

| Atributo | Exemplo | Efeito na loja |
| --- | --- | --- |
| `campanha` | `natal`, `escoamento` ou `natal,escoamento` | Entra na campanha (filtros, menu, página inicial) |
| `preco_anterior` | `3200` | Preço riscado e etiqueta −30%; só conta se for maior que o preço |
| `stock_inicial` | `60` | Base da barra "Restam N unidades" no escoamento |
| `formato` | `500 g`, `6 × 1,5 L` | Linha por baixo do nome |
| `resumo` | frase até 255 caracteres | Cartão da cesta e topo da página do produto |
| `nivel` | `ouro`, `prata`, `bronze` | Marca o produto como cesta, com a cor do nível |
| `selo` | `A mais completa` | Etiqueta no cartão da cesta |
| `item` (um por artigo) | `2 × Arroz branco 1 kg` | Lista "O que inclui" e comparação das cestas |
| `destaque` | `sim` | Secção "Destaques da loja" na página inicial |

A leitura aceita variantes (`Preço anterior`, `precoAnterior`, `Nível`, `itens` separados por `;`).
Os produtos das categorias com slug `cestas` ou `cabazes` (e variantes, ver `CABAZ_CATEGORY_SLUGS` em
`src/config/store.ts`) são cestas e entram sempre na campanha de Natal.
As imagens das cestas devem ter fundo transparente, como as de `src/assets/img/`.

## Checkout e encomendas

O checkout não precisa de conta e segue o layout: dados do cliente e NIF, levantamento numa loja (com data)
ou entrega ao domicílio (com taxa), oferta com mensagem, e pagamento por Multicaixa Express ou transferência
bancária (IBAN), conforme as Definições da loja no back-office.

Ao escolher a transferência, o checkout mostra logo o montante, o IBAN, o destinatário e o banco (Definições da
loja, via `GET /checkout/options`) e aceita o comprovativo em PDF ou imagem (JPG, PNG, WebP, até 10 MB). O
comprovativo é opcional no checkout: segue para `POST /order/{id}/payment-proof` assim que a encomenda é criada e,
se ainda não houver, o cliente envia-o depois na página da encomenda.

Com Multicaixa Express, a página da encomenda mostra um ponteiro com os 2 minutos para aceitar o pagamento no
telemóvel (fica vermelho nos últimos 30 segundos; o título do separador também conta). A contagem segue a hora
do servidor, medida pelo cabeçalho `Date` do próprio site (`src/utils/serverClock.ts`): um dispositivo com o
relógio adiantado ou atrasado vê os mesmos 2 minutos. Assim que o tempo acaba, a página mostra o formulário para
pedir outro pagamento, sem esperar que a API marque o pedido como expirado. A encomenda continua reservada
(24 horas, `app.payment.hold-hours` na API) e o cliente pede outro pagamento, para o mesmo ou outro telemóvel, ou
muda para transferência bancária; com IBAN também pode passar a Express. Vale o primeiro pagamento confirmado
(`POST /order/{id}/payment`). Acabada a reserva sem pagamento, a API cancela a encomenda e devolve o stock. Precisa
de `order-tracking` e `checkout-options` em `api_features`.

A página da encomenda volta a perguntar o estado à API (de 5 em 5 segundos no Express, de 15 em 15 no IBAN). Quando
o pagamento passa a confirmado com a página aberta, aparece a janela "Pago" (`PaidDialog.tsx`): um selo que carimba,
com papelinhos, sem animação para quem pede menos movimento. Quem fez a encomenda neste browser vê estes passos
mesmo com sessão iniciada no back-office; a equipa a ver a encomenda de outro cliente vê o tempo do Express a
contar no cartão do pagamento.

Enquanto a API não guardar estes dados, seguem também nas observações da encomenda (`notes`, até 500
caracteres), uma informação por linha, para a loja os ver no back-office. **Até o backend tratar dos pagamentos
online, as encomendas com Multicaixa Express ou referência têm de ser cobradas à mão pela loja**; para retirar
esses métodos ou a entrega ao domicílio antes disso, altere `DEFAULT_CHECKOUT_OPTIONS`.

`GET /order/{id}` é só para a equipa. Até existir o seguimento público (`order-tracking`), a página
`/encomenda/:id` mostra a encomenda guardada no browser onde foi feita (com a entrega, a taxa e o pagamento
escolhidos); noutro dispositivo explica que o estado chega por e-mail. Para a equipa com sessão iniciada
mostra o estado actual da API.

## Back-office e perfis

| Área | Perfis |
| --- | --- |
| Encomendas (ver) | ADMIN, MANAGER, SUPPORT, FINANCE, AUDITOR |
| Mudar o estado da encomenda | ADMIN, MANAGER, SUPPORT |
| Produtos, livros, categorias, lojas de levantamento | ADMIN, MANAGER |
| Definições da loja (ver) | ADMIN, MANAGER |
| Definições da loja (alterar), Aparência | ADMIN |
| Utilizadores, Perfis e permissões | ADMIN |

A tabela é a das regras fixas da API (`PERMISSIONS` em `src/utils/auth.ts`). Com `role-permissions` em
`api_features`, as permissões de cada perfil vêm da API e o ADMIN muda-as no back-office.

O layout segue a base do People Connect, em tamanho compacto (`src/components/backoffice/BackofficeLayout.*`):
fonte Outfit, barra verde no topo com a pesquisa de encomendas (abre `/backoffice/encomendas?q=`) e o menu com as
páginas agrupadas (Geral, Catálogo, Loja, Administração). Por omissão o menu fica à esquerda: os grupos abrem e
fecham (só o da página actual vem aberto) e o botão do topo recolhe-o aos ícones, com o nome ao lado ao passar o
rato. No menu da conta, cada pessoa pode trocar para a barra horizontal por baixo do topo. A escolha fica no
browser (`menuPreferences.ts`). Até 1024 px o menu sai de lado, seja qual for a escolha.

**Utilizadores** (`/backoffice/utilizadores`, só ADMIN): contas da equipa e clientes registados, com pesquisa e filtro
por perfil. Cria contas (com password gerada), muda os perfis e elimina. Ninguém pode tirar o perfil de
administrador a si próprio nem ao único administrador. **Perfis e permissões** (`/backoffice/permissoes`) mostra o que
cada perfil pode fazer. Com `role-permissions`, a tabela passa a ser editável e permite criar perfis novos. O que
falta na API está na secção 9 de `docs/api-campos-em-falta.md`.

**Encomendas** (`/backoffice/encomendas`): separadores por estado com contagens, pesquisa, filtros (loja, pagamento,
entrega), ordem e páginas de 25, tudo no endereço (ao voltar do detalhe a lista está como estava). Cada linha mostra a
referência e a data, o cliente, os artigos, a entrega, o pagamento (com "Comprovativo por verificar"), o estado e o
total, e abre o detalhe. O **detalhe** (`/backoffice/encomendas/:id`) tem as etapas, os artigos e os totais, o
cliente (telefone e e-mail clicáveis, outras encomendas), a entrega, o pagamento com o comprovativo (ver, confirmar,
recusar) e o botão do passo seguinte (começar a preparar, marcar como pronta, entregue) ou cancelar. Imprime-se
sem barras nem botões.

Em **Aparência** (`/backoffice/aparencia`, só ADMIN) escolhem-se nove cores, ou um conjunto pronto: estrutura
(principal, destaque, barra do menu, fundo), gráficos (série principal e segunda série) e alertas (concluído,
atenção, crítico). O back-office mostra-as logo, antes de gravar. Os tons derivados são calculados em
`theme/theme.ts`: o texto legível sobre cada cor, a escala do funil a partir da série principal e o texto dos
alertas escurecido até 4,5:1. As cores dos gráficos seguem as regras da paleta do painel (tom médio, cor viva, as duas
séries distinguíveis com visão normal e com daltonismo); um par como vermelho/verde, um fundo escuro ou uma cor
principal clara demais não se gravam. Com `backoffice-theme` em `api_features`, as cores vêm de
`GET /settings/theme` e gravam-se com `PUT /settings/theme` (um mapa chave → `#rrggbb`), para toda a equipa; sem
ela, ficam só no browser de quem as escolheu.

O estado das encomendas segue o fluxo Pendente → Em Processamento → Pronto para Entrega → Entregue, com
Cancelado possível antes de Entregue; cada mudança envia um e-mail ao cliente.

Na lista de Produtos, o olho oculta um produto da loja sem o eliminar (`available=false`, gravado com
`PUT /product/{id}` e os restantes dados tal como estão): sai do catálogo, da pesquisa, das categorias e dos
carrinhos, e a API recusa-o nas encomendas. A lista pede também os ocultos
(`GET /product/list?includeUnavailable=true`), assinala-os como Oculto e volta a mostrá-los com o mesmo botão; o
cartão "Ocultos na loja" filtra-os. No formulário do produto é a opção "Visível na loja".

## Pedidos à equipa da API

Ver [docs/api-campos-em-falta.md](docs/api-campos-em-falta.md): encomendas (entrega, pagamento, oferta, NIF),
pagamentos online, seguimento público, opções do checkout, campanhas, campos próprios dos produtos, dados das
lojas, e ainda a URL de seguimento dos e-mails e as origens CORS.
