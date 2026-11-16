# Campos e endpoints em falta na API

Pedido do frontend Super7 Digital à equipa da Pumangol Marketplace API.

O frontend já implementa todas as funções do layout: entrega ao domicílio com taxa, pagamento Multicaixa Express e por referência, oferta com mensagem, NIF, campanhas, dados das lojas e seguimento público da encomenda. Faltam os campos e endpoints abaixo para estas funções ficarem completas no servidor.

Tudo o que se pede é **opcional e compatível com a versão actual**: nenhum campo existente muda de nome ou de tipo. Os nomes seguem o estilo dos DTOs actuais (camelCase, enums em maiúsculas). Os tipos TypeScript equivalentes estão em `src/types/api.ts`, marcados com "Proposto".

## Como o frontend funciona até lá

- **Campos novos nos pedidos**: o frontend já os envia. A API actual ignora-os, porque o `ObjectMapper` do Spring Boot tem `FAIL_ON_UNKNOWN_PROPERTIES` desligado por omissão. **Não ligar essa opção** antes de implementar estes campos, ou os pedidos do frontend passam a falhar com 400.
- **Cópia de segurança nas observações**: entrega, pagamento, NIF e oferta também seguem em `notes` (até 500 caracteres), para a loja os ver no back-office.
- **Campos novos nas respostas**: o frontend usa-os assim que aparecem, sem nova publicação.
- **Endpoints novos**: só são chamados quando activados na variável de ambiente `api_features` do frontend, para não gerar erros 404 enquanto não existem.

| `api_features` | Activar quando a API tiver |
| --- | --- |
| `campaigns` | `GET /campaign` |
| `checkout-options` | `GET /checkout/options` |
| `order-tracking` | `GET /order/{id}/tracking` |
| `order-fields` | Os campos novos de `POST /order` gravados. As observações deixam de levar a cópia de segurança. |

Exemplo: `api_features=campaigns,checkout-options,order-tracking,order-fields`

## Resumo por prioridade

| # | Área | O que falta | Prioridade |
| --- | --- | --- | --- |
| 1 | Encomendas | Entrega, data de levantamento, oferta, NIF, método de pagamento e taxa de entrega em `POST /order` e na resposta | Alta (campanha de Natal) |
| 2 | Pagamentos | Pedido Multicaixa Express, geração de referência, confirmação do pagamento | Alta |
| 3 | Seguimento | `GET /order/{id}/tracking` público, para o link dos e-mails | Alta |
| 4 | Checkout | `GET /checkout/options`: taxa e zonas de entrega, métodos de pagamento | Média |
| 5 | Campanhas | `GET /campaign` e gestão das campanhas | Média |
| 6 | Produtos | Campos próprios para campanha, preço anterior e cabazes (hoje em `attributes`) | Média |
| 7 | Lojas | Zona, morada, horário e telefone do posto de recolha | Média |
| 8 | Outros | E-mail opcional com SMS, localização opcional no levantamento, produtos indisponíveis no back-office, URL de seguimento e CORS | Baixa |

## 1. Encomendas: `POST /order` e resposta

### Pedido: campos novos em `OrderRequestDTO`

| Campo | Tipo | Obrigatório | Regras |
| --- | --- | --- | --- |
| `deliveryType` | enum `DeliveryType`: `PICKUP`, `HOME_DELIVERY` | Não (omissão `PICKUP`) | `HOME_DELIVERY` só se a entrega estiver activa nas opções do checkout |
| `pickupDate` | `LocalDate` (AAAA-MM-DD) | Com `PICKUP` | A partir de amanhã. Durante a campanha de Natal, até ao último dia da campanha |
| `deliveryAddress` | objecto `DeliveryAddress` | Com `HOME_DELIVERY` | Ver abaixo |
| `deliveryAddress.address` | `String`, até 160 | Sim | Rua, número, casa |
| `deliveryAddress.district` | `String`, até 80 | Sim | Bairro ou município |
| `deliveryAddress.reference` | `String`, até 120 | Não | Ponto de referência |
| `gift` | objecto `OrderGift` | Não | Só quando a encomenda é para oferecer |
| `gift.recipient` | `String`, até 60 | Sim, se houver `gift` | Pessoa, equipa ou empresa |
| `gift.message` | `String`, até `giftMessageMaxLength` (240) | Não | Texto do cartão Boas Festas |
| `paymentMethod` | enum `PaymentMethod`: `MULTICAIXA_EXPRESS`, `REFERENCE`, `IN_STORE` | Não (omissão `IN_STORE`) | `IN_STORE` só com `PICKUP` |
| `paymentPhone` | `String`, 9 dígitos começados por 9 | Com `MULTICAIXA_EXPRESS` | Telemóvel que recebe o pedido de pagamento |
| `customer.nif` | `String`, até 20 | Não | Guardar **na encomenda**: o cliente é reutilizado pelo e-mail ou telefone e não é actualizado no checkout |

Regras:

- `pickupPostId` continua obrigatório. Na entrega ao domicílio é a loja que prepara e envia a encomenda; o cliente escolhe a mais próxima.
- A **taxa de entrega é calculada pelo servidor**, a partir das opções do checkout. O frontend mostra-a, mas não a envia. No levantamento é 0.
- `customer.location` continua obrigatório hoje. O frontend envia o bairro na entrega ao domicílio e a zona (ou o nome) da loja no levantamento. Ver o ponto 8.

Exemplo:

```json
{
  "customer": {
    "fullName": "Maria João",
    "phone": "923000000",
    "email": "maria@exemplo.ao",
    "location": "Morro Bento",
    "nif": "5000000000"
  },
  "pickupPostId": "74ee299e-3287-4a69-9611-6d5cb20f60b9",
  "deliveryType": "HOME_DELIVERY",
  "deliveryAddress": { "address": "Rua 21 de Janeiro, casa 12", "district": "Morro Bento", "reference": "Junto à escola" },
  "gift": { "recipient": "Equipa Comercial", "message": "Boas Festas e um próspero Ano Novo!" },
  "paymentMethod": "MULTICAIXA_EXPRESS",
  "paymentPhone": "923000000",
  "notes": "Ligar antes de entregar",
  "items": [{ "productId": "9b1d4c2e-0b8a-4c4e-9a51-2f7d3c1e8a10", "quantity": 2 }]
}
```

### Resposta: campos novos em `OrderResponseDTO`

Em `POST /order`, `GET /order`, `GET /order/{id}` e `PUT /order/{id}/status`:

| Campo | Tipo | Notas |
| --- | --- | --- |
| `deliveryType` | `DeliveryType` | |
| `pickupDate` | `LocalDate` ou `null` | |
| `deliveryAddress` | `DeliveryAddress` ou `null` | |
| `gift` | `OrderGift` ou `null` | |
| `customer.nif` | `String` ou `null` | O da encomenda |
| `subtotal` | `BigDecimal` | Soma dos `subTotal` dos itens (o `total` de hoje) |
| `deliveryFee` | `BigDecimal` | 0 no levantamento |
| `total` | `BigDecimal` | **Passa a ser `subtotal + deliveryFee`** |
| `payment` | `OrderPayment` | Ver o ponto 2 |

O frontend decide pela presença de `deliveryFee`: com esse campo na resposta, assume que `total` já inclui a taxa; sem ele, soma a taxa que mostrou no checkout.

Os e-mails da encomenda (`OrderNotificationEmailBuilder`) devem passar a mostrar a entrega (loja e data, ou morada), a oferta, a taxa de entrega e, no pagamento por referência, a entidade, a referência e o montante.

## 2. Pagamentos

Objecto `payment` na resposta da encomenda:

| Campo | Tipo | Notas |
| --- | --- | --- |
| `method` | `PaymentMethod` | |
| `status` | enum `PaymentStatus`: `PENDING`, `PAID`, `FAILED`, `EXPIRED` | Independente do estado da encomenda |
| `phone` | `String` ou `null` | Multicaixa Express |
| `entity` | `String` ou `null` | Referência: entidade |
| `reference` | `String` ou `null` | Referência: número, pode vir formatado ("123 456 789") |
| `amount` | `BigDecimal` | Montante a pagar (= `total`) |
| `expiresAt` | `OffsetDateTime` ou `null` | Validade da referência ou do pedido Multicaixa Express |
| `paidAt` | `OffsetDateTime` ou `null` | |

```json
"payment": {
  "method": "REFERENCE",
  "status": "PENDING",
  "phone": null,
  "entity": "00123",
  "reference": "123 456 789",
  "amount": 9500,
  "expiresAt": "2026-11-17T23:59:00+01:00",
  "paidAt": null
}
```

Comportamento esperado:

- **`MULTICAIXA_EXPRESS`**: ao criar a encomenda, enviar o pedido de pagamento para `paymentPhone` através do prestador de pagamentos (a escolher pela Pumangol) e devolver `status: PENDING`.
- **`REFERENCE`**: gerar entidade e referência, devolvê-las na resposta de `POST /order` e no e-mail de confirmação.
- **`IN_STORE`**: `status: PENDING` até a loja confirmar o pagamento no levantamento.
- **Confirmação**: o prestador avisa o servidor (webhook), que marca `PAID` e regista `paidAt`. O cliente vê o passo "Pagamento confirmado".
- **`EXPIRED` ou `FAILED`**: recomenda-se cancelar a encomenda e devolver o stock reservado em `OrderStockService`.
- **Back-office**: para o pagamento na loja e para acertos manuais, uma rota como `PUT /order/{id}/payment-status?status=PAID` (perfis ADMIN, MANAGER, FINANCE). **O back-office do frontend ainda não tem este botão**; avisem quando a rota existir.

## 3. Seguimento público: `GET /order/{id}/tracking`

O link dos e-mails (`/encomenda/{id}`) abre no telemóvel ou computador do cliente, sem sessão. Hoje `GET /order/{id}` exige um perfil de equipa, por isso o cliente só vê a encomenda no browser onde a fez.

- Rota pública, sem token.
- Devolve o mesmo envelope e o mesmo `OrderResponseDTO`, com **dados pessoais limitados**: `customer.fullName` (ou só o primeiro nome), `phone` e `email` vazios, `notes` a `null`.
- 404 se a encomenda não existir.
- Recomenda-se limite de pedidos por IP. O UUID é difícil de adivinhar, mas a rota é pública.

## 4. Opções do checkout: `GET /checkout/options`

Rota pública. O servidor usa os mesmos valores para validar a encomenda e calcular a taxa.

```json
{
  "status": "OK",
  "data": {
    "homeDeliveryEnabled": true,
    "homeDeliveryFee": 2500,
    "homeDeliveryZones": ["Luanda"],
    "paymentMethods": ["MULTICAIXA_EXPRESS", "REFERENCE", "IN_STORE"],
    "giftMessageMaxLength": 240
  },
  "errors": []
}
```

Até existir, o frontend usa estes mesmos valores (os do layout), definidos em `DEFAULT_CHECKOUT_OPTIONS` (`src/config/store.ts`). A entrega ao domicílio só aparece se houver pelo menos um método de pagamento online.

## 5. Campanhas: `GET /campaign`

Rota pública com as campanhas activas.

| Campo | Tipo | Notas |
| --- | --- | --- |
| `id` | UUID | |
| `slug` | `String`, único | `natal`, `escoamento`: é o valor usado em `Product.campaigns` |
| `name` | `String` | "Boas Festas 2026" |
| `description` | `String` ou `null` | |
| `startDate`, `endDate` | `LocalDate` | Inclusive |
| `ordersUntil` | `OffsetDateTime` ou `null` | Prazo das encomendas: alimenta a contagem decrescente da página inicial |
| `active` | `Boolean` | Desliga a campanha mesmo dentro das datas |

Gestão: `POST`, `PUT /{id}`, `DELETE /{id}` para ADMIN e MANAGER. O back-office do frontend ainda não tem uma página de campanhas: hoje as datas estão em `CAMPAIGNS` (`src/config/store.ts`).

## 6. Produtos: campos próprios

Hoje a campanha, o preço anterior e a composição dos cabazes estão em `attributes`, com uma convenção de nomes. Pede-se que passem a campos de `ProductRequestDTO` e `ProductResponseDTO`:

| Campo | Tipo | Regras | Atributo actual |
| --- | --- | --- | --- |
| `campaigns` | `List<String>` | Slugs de campanhas existentes | `campanha` (`natal,escoamento`) |
| `previousPrice` | `BigDecimal` | Maior que `price` | `preco_anterior` |
| `initialStock` | `Integer` | 0 ou mais | `stock_inicial` |
| `format` | `String`, até 255 | | `formato` |
| `summary` | `String`, até 255 | | `resumo` |
| `hamperLevel` | enum `HamperLevel`: `GOLD`, `SILVER`, `BRONZE` | | `nivel` (`ouro`, `prata`, `bronze`) |
| `badge` | `String`, até 255 | | `selo` |
| `hamperItems` | `List<HamperItem>`: `name` (até 240), `quantity` (inteiro, 1 ou mais) | | `item` (`"2 × Arroz branco 1 kg"`, um por artigo) |
| `featured` | `Boolean` | | `destaque` (`sim`) |

- O frontend lê primeiro estes campos e, para os que vêm vazios, os atributos. O back-office grava ambos, por isso os produtos criados hoje não precisam de ser refeitos: basta uma migração que leia os atributos da tabela acima.
- Opcional, para quando o catálogo crescer: pesquisa no servidor em `GET /product` (`q`, `campaign`, `maxPrice`, `inStock`, `sort` por preço ou desconto). Hoje o frontend filtra o catálogo completo de `GET /product/list` no browser.

## 7. Lojas: postos de recolha

Campos novos em `PickupPostRequestDTO` e `PickupPostResponseDTO`, devolvidos também em `GET /pickup-post/findList`:

| Campo | Tipo | Exemplo |
| --- | --- | --- |
| `zone` | `String`, até 120 | "Talatona, Luanda" |
| `address` | `String`, até 255 | "Via S8, posto Pumangol de Talatona" |
| `openingHours` | `String`, até 120 | "Todos os dias, 06h00–22h00" |
| `phone` | `String`, até 20 | "923 000 000" |

O back-office já tem estes campos no formulário das lojas. Hoje avisa que a API só guarda o nome.

## 8. Outros

- **E-mail opcional**: no layout o e-mail é opcional. Hoje a API exige-o e é o único canal de notificação, por isso o frontend mantém-no obrigatório. Para o tornar opcional, a API precisa de aceitar `customer.email` vazio e de notificar por SMS.
- **Localização opcional no levantamento**: `customer.location` é obrigatório, mas no levantamento não tem uso. Proposta: obrigatório só com `HOME_DELIVERY`.
- **Produtos indisponíveis no back-office**: `GET /product` e `GET /product/list` só devolvem produtos com `available=true`. Um produto marcado como indisponível desaparece também do back-office. Proposta: `GET /product?includeUnavailable=true` para ADMIN e MANAGER.
- **URL de seguimento**: actualizar `app.order.tracking-url` para o domínio do Super7 Digital (o caminho `/encomenda/{id}` mantém-se).
- **CORS**: restringir `APP_CORS_ALLOWED_ORIGINS` aos domínios da loja e do back-office.
