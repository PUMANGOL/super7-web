# Super7 Digital

Loja online das lojas de conveniência Super7 dos postos Pumangol, com back-office para a equipa.
Nesta primeira fase a página inicial está centrada na **campanha de Natal** (cabazes Ouro, Prata e Bronze
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
    ├── fonts/, img/         # Montserrat e Figtree alojadas no projecto; cabazes e fotografias das lojas
```

O back-office é carregado à parte (`React.lazy`): quem visita a loja não descarrega esse código.

## Rotas

| Rota | Página |
| --- | --- |
| `/` | Página inicial (campanha de Natal e escoamento) |
| `/catalogo?campanha=&categoria=&q=&precoMax=&emStock=1&ordenar=&pagina=` | Catálogo com filtros na URL |
| `/produto/:id` | Detalhe do produto ou cabaz |
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
  `campaigns`, `checkout-options`, `order-tracking`, `order-fields` (ver `src/config/store.ts`).
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
| `resumo` | frase até 255 caracteres | Cartão do cabaz e topo da página do produto |
| `nivel` | `ouro`, `prata`, `bronze` | Marca o produto como cabaz, com a cor do nível |
| `selo` | `O mais completo` | Etiqueta no cartão do cabaz |
| `item` (um por artigo) | `2 × Arroz branco 1 kg` | Lista "O que inclui" e comparação dos cabazes |
| `destaque` | `sim` | Secção "Destaques da loja" na página inicial |

A leitura aceita variantes (`Preço anterior`, `precoAnterior`, `Nível`, `itens` separados por `;`).
Os produtos da categoria com slug `cabazes` são cabazes e entram sempre na campanha de Natal.
As imagens dos cabazes devem ter fundo transparente, como as de `src/assets/img/`.

## Checkout e encomendas

O checkout não precisa de conta e segue o layout: dados do cliente e NIF, levantamento numa loja (com data)
ou entrega ao domicílio (com taxa), oferta com mensagem, e pagamento por Multicaixa Express, referência ou
na loja (este só com levantamento).

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

O estado das encomendas segue o fluxo Pendente → Em Processamento → Pronto para Entrega → Entregue, com
Cancelado possível antes de Entregue; cada mudança envia um e-mail ao cliente.

## Pedidos à equipa da API

Ver [docs/api-campos-em-falta.md](docs/api-campos-em-falta.md): encomendas (entrega, pagamento, oferta, NIF),
pagamentos online, seguimento público, opções do checkout, campanhas, campos próprios dos produtos, dados das
lojas, e ainda a URL de seguimento dos e-mails e as origens CORS.
