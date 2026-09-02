# Memory Gauge — Digimon TCG

Contador de **memória compartilhada** para partidas de Digimon Card Game.
HTML, CSS e JavaScript puros — sem build, sem dependências, sem framework.

Feito para ficar deitado na mesa entre os dois jogadores: o painel de cima
fica girado 180°, e a régua de -10 a 10 no meio mostra de quem é o contador.

## Funcionalidades

- **Régua de 21 casas** (10 de um lado, 0, 10 do outro) com contador animado.
- **Troca de turno automática** quando o contador cruza para o lado do oponente,
  entregando exatamente a memória empurrada — sem piso, então passar com 1 funciona.
- **Encerrar o turno** com o contador em 0 ou do próprio lado entrega 3 ao oponente.
- **Teclado de custo** de 1 a 8 para pagar o custo da carta em um toque.
- **Dois lados sempre ativos**, porque efeitos de *Counter* custam memória
  durante o turno do oponente.
- **Toque direto na régua** para corrigir a posição manualmente.
- **Desfazer** com histórico de até 80 jogadas.
- **Nomes editáveis**, vibração na troca de turno e opção de manter a tela ligada.
- **Estado salvo no aparelho** — fechar e reabrir não perde a partida.
- **PWA offline**: instalável e funciona sem internet depois da primeira visita.

## Layout em paisagem no celular

Otimizado para o Galaxy S20 FE deitado (915×412 CSS), que é a posição natural
com o aparelho na mesa entre os jogadores:

- Novo jogo, Regras e Ajustes ficam num **menu hamburguer** na barra central,
  deixando só ele e o Desfazer visíveis durante a partida.
- Cada painel vira **duas colunas**: 30% com `− valor +` e 70% com o teclado de
  custo sobre o botão de encerrar turno.
- A régua ocupa a largura toda, sem as etiquetas de ponta (os nomes já
  aparecem nos painéis).
- O aviso de troca de turno ancora **sobre a barra central** em vez do rodapé,
  onde cobriria o botão de encerrar turno do jogador de baixo.
- Os Ajustes abrem em duas colunas, para caber sem rolagem.

Alvos de toque na horizontal: teclado de custo 49px, botões redondos 50px,
hamburguer 44px, casas da régua 43×45px.

## Atalhos de teclado

| Tecla | Ação |
|---|---|
| `1`–`9` | jogador da vez paga esse custo |
| `G` | jogador da vez ganha 1 de memória |
| `←` `→` | movem o contador na régua |
| `Espaço` / `Enter` | encerrar turno |
| `Z` | desfazer |
| `M` | abrir o menu |
| `N` | novo jogo |
| `?` | abrir as regras |

## Estrutura

```
DigimonMemoryGauge/
├── index.html              # marcação e diálogos
├── css/styles.css          # tema escuro, layout de mesa, régua
├── js/app.js               # estado, regras de memória, render
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
