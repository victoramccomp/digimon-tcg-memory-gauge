# Memory Gauge — Digimon TCG

Contador de **memória compartilhada** para partidas de Digimon Card Game.
HTML, CSS e JavaScript puros — sem build, sem dependências, sem framework.

Feito para ficar deitado na mesa entre os dois jogadores: o painel de cima
fica girado 180°, e a régua de -10 a 10 no meio mostra de quem é o contador.

## Funcionalidades

- **Régua de 21 casas** em hexágonos (10 de um lado, 0, 10 do outro), como um
  mostrador: a janela mostra 11 casas — a atual no centro e 5 de cada lado — e
  a tira desliza sob um marcador fixo.
- **Troca de turno automática** quando o contador cruza para o lado do oponente,
  entregando exatamente a memória empurrada — sem piso, então passar com 1 funciona.
- **Encerrar o turno** com o contador em 0 ou do próprio lado entrega 3 ao oponente.
- **Teclado de custo** de 1 a 8 para pagar o custo da carta em um toque.
- **O painel de quem não está na vez recua** (opacidade 0,42), enquanto o de
  quem joga e a régua ficam em brilho cheio. Os controles do lado esmaecido
  continuam clicáveis de propósito — é só recuo visual.
- **Dois lados sempre ativos**, porque efeitos de *Counter* custam memória
  durante o turno do oponente.
- **Toque direto na régua** para corrigir a posição manualmente.
- **Sorteio de quem começa** num digivice, com duas luzes girando 5 segundos
  em velocidade crescente até parar na cor do vencedor. Cara ou coroa honesto,
  50/50.
- **Desfazer** com histórico de até 80 jogadas.
- **Nomes editáveis**, vibração na troca de turno e opção de manter a tela ligada.
- **Estado salvo no aparelho** — fechar e reabrir não perde a partida.
- **PWA offline**: instalável e funciona sem internet depois da primeira visita.

## Fundo de circuitos

Gerado em [`js/circuit.js`](js/circuit.js) a partir de uma grade, em camadas:

| Camada | O que é |
|---|---|
| `base` | traços da placa com cantos em 45°, vias nas pontas e chips |
| `lit` | vias e chips que acendem e apagam parados |
| `pulse` | as luzes que percorrem os traços |

### As luzes

Feitas com `stroke-dasharray`: um traço curto e um vão maior que o caminho,
então existe uma luz por vez e ela some entre uma passagem e outra. A duração
sai da **velocidade**, não do comprimento — senão traço longo teria luz rápida
e traço curto luz lenta.

Medido: 14 traços com luz, **4,2 visíveis ao mesmo tempo** em média, a 70–150
px/s, cada luz ocupando cerca de 10–28% do traço em que corre.

### Custo e acessibilidade

- **Semente fixa**: o desenho é sempre o mesmo em cada tamanho de tela.
- Só `stroke-dashoffset` e opacidade são animados — nada de blur ou filtro,
  que pesariam numa partida longa de celular. São 129 elementos, dos quais
  64 animados.
- Redesenha ao girar a tela, via `ResizeObserver` com os eventos de janela e
  `visibilitychange` como reforço.
- Respeita `prefers-reduced-motion`: as luzes somem, os anéis param e os
  traços ficam acesos de leve.
- Pode ser desligado nos Ajustes, para economizar bateria.

Os painéis têm base escura própria (`rgba(11,16,25,.66)`) para que o fundo
passe por trás sem disputar contraste: no pico, uma luz chega ao conteúdo a
0,22 de opacidade.

## O sorteio de quem começa

"Novo jogo" abre o digivice com duas luzes — a azul do Jogador 1 e a laranja do
Jogador 2 — girando por 5 segundos em velocidade crescente. No fim o digivice
assume a cor de quem começa.

- **O lado sai antes da animação**, de `Math.random() < 0.5`. O giro só encena
  o resultado; não há nada na animação que possa enviesar o sorteio. Verificado
  com 400 sorteios: 191/209.
- As duas luzes ficam a **180° uma da outra**, então parar em 10 voltas cheias
  deixa a azul no marcador do topo e 10 voltas e meia deixa a laranja. O giro
  aterrissa de verdade no resultado, em vez de parar em qualquer lugar e trocar
  a cor.
- A aceleração vem do `cubic-bezier(.55, 0, .8, .55)`, que é lento no começo e
  rápido no fim.
- O digivice é [`digivice.svg`](digivice.svg) usado como **máscara CSS**, não
  como imagem: assim a cor dele é só o `background` da caixa e vira a cor do
  vencedor com uma transição. O SVG é traçado em linha, com `fill` preto —
  como imagem ele sumiria no fundo escuro.
- As medidas do círculo saíram de sondagem do próprio desenho, não de chute:
  centro em 49,29% / 49,17% e raio 24,9% da largura. As luzes orbitam em
  20,5%, na faixa livre entre os detalhes internos (17,7%) e o anel.
- Fechar o sorteio antes do fim **cancela**: o jogo novo não começa.
- Com `prefers-reduced-motion` o giro é pulado e o resultado aparece direto.
- "Escolher manualmente" continua disponível, para quem já decidiu na mesa.

## A régua

Um mostrador, não uma barra: a janela mostra 11 casas das 21 — a atual no
centro e 5 inteiras de cada lado — e a tira desliza sob um marcador fixo.
Quem se move é a régua.

- A tira tem **2100%/11 da janela**, então cada uma das 21 casas mede
  (2100/11)/21 = 1/11 da janela: 11 à vista. Não pode haver `gap` entre as
  casas, senão a conta quebra; o respiro entre hexágonos vem do recuo do
  `::before`.
- O deslocamento é `translateX(calc((5 - var(--i)) * 100% / 21))`, onde `--i`
  é o índice da casa atual. Medido: a casa ativa fica a menos de 0,1px do
  centro em toda a faixa.
- Em paisagem a altura da régua é **exatamente a da coluna de botões**
  (`calc(3 * var(--tool) + 2 * var(--tool-gap))`), então a faixa do meio fica
  cheia e simétrica em vez de ter a régua flutuando com folga em cima e
  embaixo.
- Os hexágonos são **de ponta para cima**: com a régua ocupando toda a faixa,
  a casa fica mais alta que larga, e um hexágono deitado sairia esticado.
- A janela usa `overflow: clip`, não `hidden`: `clip` não cria área rolável,
  então dar foco numa casa fora da janela não desloca a tira e não desalinha
  o mostrador.
- Em retrato a altura vem de `aspect-ratio`, para o hexágono não perder a
  proporção numa tela estreita. **Cuidado**: com altura definida e largura
  automática, `aspect-ratio` passa a mandar na *largura* e encolhe a régua —
  por isso o bloco de paisagem zera a razão com `aspect-ratio: auto`.
- `clip-path` corta `box-shadow`, então o brilho da casa ativa vem de
  `drop-shadow`, que acompanha o recorte.

**Consequência**: só as casas visíveis (±5 em volta da atual) podem ser tocadas
para ajuste manual — o que cobre toda a régua em dois toques, já que cada
toque recentra e revela mais 5 casas do lado. Nos extremos (±10) a tira chega
ao fim e metade da janela fica vazia, que é o mostrador no batente.

## Layout em paisagem no celular

Otimizado para o Galaxy S20 FE deitado (915×412 CSS), que é a posição natural
com o aparelho na mesa entre os jogadores:

- **A faixa do meio é só da régua.** Os botões saem para uma coluna estreita
  de 35px na esquerda (menu, desfazer, informação) e a régua fica com os
  855px restantes, ocupando a faixa inteira em altura (113px).
- **Sem o texto de turno no meio** — de quem é a vez já se lê no painel aceso.
  No lugar dele entra o botão **i**, que abre turno atual e memória
  disponível. Em retrato o botão some, porque lá a faixa de turno aparece.
- Novo jogo, Regras e Ajustes ficam num **menu hamburguer**.
- Cada painel vira **duas colunas**: 30% com `− valor +` e 70% com o teclado de
  custo sobre o botão de encerrar turno.
- A régua não mostra as etiquetas de ponta (os nomes já estão nos painéis).
- O aviso de troca de turno ancora na **folga acima da régua**: no rodapé
  cobria o botão de encerrar turno do jogador de baixo, e no meio cobriria a
  própria régua.
- Os Ajustes abrem em duas colunas, para caber sem rolagem.

Alvos de toque na horizontal: teclado de custo 49px, botões redondos 50px,
casas da régua 78×113px, e 35px nos três botões da coluna — menores porque são
controles secundários, fora do fluxo da partida.

## Atalhos de teclado

| Tecla | Ação |
|---|---|
| `1`–`9` | jogador da vez paga esse custo |
| `G` | jogador da vez ganha 1 de memória |
| `←` `→` | movem o contador na régua |
| `Espaço` / `Enter` | encerrar turno |
| `Z` | desfazer |
| `M` | abrir o menu |
| `I` | turno atual e memória disponível |
| `N` | novo jogo |
| `?` | abrir as regras |

## Estrutura

```
DigimonMemoryGauge/
├── index.html              # marcação e diálogos
├── css/styles.css          # tema escuro, layout de mesa, régua
├── js/app.js               # estado, regras de memória, render, sorteio
├── digivice.svg            # traçado do digivice, usado como máscara CSS
├── sw.js                   # service worker (offline)
├── manifest.webmanifest    # instalação como app
├── icons/icon.svg
├── vercel.json             # headers e cache
└── README.md
```

## Rodando localmente

Qualquer servidor estático serve. O service worker só é registrado em
`https` ou `localhost` — abrir o `index.html` direto pelo `file://` funciona,
mas sem o modo offline.

```bash
npx serve .
```

## Publicando na Vercel

### Opção A — CLI, direto desta pasta

```bash
npx vercel deploy --prod
```

Na primeira execução a CLI pede login e algumas confirmações. Como o projeto é
estático, basta aceitar os padrões: framework **Other**, sem build command e com
o diretório de saída em branco (a raiz do projeto).

### Opção B — Git + importação no painel

1. Suba a pasta para um repositório no GitHub.
2. Em [vercel.com/new](https://vercel.com/new), importe o repositório.
3. Framework Preset: **Other**. Sem build command. Output Directory: a raiz.
4. Deploy. Cada `git push` publica uma nova versão.

## Como a memória funciona no jogo

Não existe mana nem terreno: um único contador é compartilhado pelos dois
jogadores numa régua que vai de 10 de um lado, passa pelo 0 e chega a 10 do
outro.

- A partida **começa com o contador em 0**, e o jogador inicial abre o turno
  sem memória nenhuma.
- **Pagar** custos empurra o contador na direção do oponente.
- **Ganhar** memória traz o contador de volta.
- O **turno acaba** assim que o contador entra no lado do oponente — e ele
  começa o turno dele com **exatamente** aquela memória de graça. Não existe
  piso: empurrar até 1 entrega só 1.
- Quem **encerra a fase principal** com o contador em 0 ou do próprio lado
  entrega 3 de memória ao oponente.

Daí vem a decisão central do jogo: fazer uma jogada grande agora e entregar um
turno enorme depois, ou parar em 1 de memória para sufocar o oponente.

---

Projeto de fã, sem fins lucrativos e sem afiliação com a Bandai.
Digimon e Digimon Card Game são marcas registradas de seus respectivos detentores.
