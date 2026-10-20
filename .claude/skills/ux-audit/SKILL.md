---
name: ux-audit
description: Auditoria de UX e usabilidade de aplicações web responsivas, com evidência rastreável, severidade calculada e backlog priorizado de correções. Use SEMPRE que o usuário pedir para avaliar, auditar, revisar, criticar ou "dar uma olhada" na usabilidade, UX, interface, telas, fluxo, jornada ou acessibilidade de um site, app web, landing page, formulário, checkout ou painel — inclusive quando ele apenas manda uma URL (deploy de preview, Vercel, Netlify, ambiente efêmero, localhost) ou prints/screenshots de telas e pergunta "o que dá pra melhorar", "tá bom?", "onde o usuário trava", "por que ninguém converte" ou "revisa esse fluxo". Também para heurísticas de Nielsen, Laws of UX, avaliação heurística, review de responsividade, mobile, breakpoints, WCAG e acessibilidade de interface. Dispare mesmo em pedidos informais, em português ou inglês, e mesmo que o usuário não use a palavra "auditoria". Use também para a segunda metade do ciclo — quando o usuário pedir para "corrigir", "aplicar as correções", "resolver o que você listou", "seguir a lista" ou autorizar itens por ID de uma auditoria já entregue — a skill lista o que precisa mudar e por quê, espera autorização explícita, aplica e reverifica por medição.
---

# Auditoria de UX — aplicações web responsivas

## O que esta skill produz, e o que ela não pode produzir

Esta skill faz **predição de defeitos por inspeção**. Ela nunca observa usuários reais, então a afirmação mais forte que pode emitir é: *"isto tem alta probabilidade de causar erro, hesitação ou abandono, por este mecanismo"*. Nada aqui é evidência de que causa.

Isso não é uma ressalva de rodapé — é o que organiza toda a saída. Cada achado nasce em uma de duas categorias, e misturá-las destrói a utilidade do relatório:

| | **Defeito** | **Hipótese** |
|---|---|---|
| Verificável | na própria interface, por qualquer pessoa | só com usuários reais |
| Exemplos | alvo de 24px, contraste 2.8:1, dado perdido no voltar, sem estado de erro | o rótulo faz sentido? o modelo mental bate? a função é descoberta? |
| Decisão que fecha | **corrija** | **teste**: com quem, por qual método, qual critério |

Uma skill que emite hipóteses com a confiança de defeitos produz backlog que a equipe aprende a ignorar. Separe sempre.

## Passo 0 — Sonde antes de perguntar

Este é o único momento da auditoria em que você tem **zero** evidência — e por isso o mais propenso a fabricação. A regra que protege os achados vale aqui com a mesma força: **nada que você não observou entra numa pergunta como se fosse dado.**

### 0a. Olhe o que já está acessível

Antes de perguntar qualquer coisa, gaste dois minutos no que o usuário já entregou. Cada resposta que a sondagem produz sai da pergunta:

| Você tem | Olhe | Isso responde |
|---|---|---|
| Repositório local | `README`, `package.json` (scripts, framework), pasta de rotas (`app/`, `pages/`, `routes/`, `router.*`) | que produto é, quais rotas existem, como subir o dev server |
| URL viva | `capture.py` só na home, 1 viewport — leia `title`, `headings`, nomes e `href` dos links de navegação | vocabulário do produto, rotas reais, se exige login |
| Prints | Leia todos antes de falar. Títulos, menus e CTAs dizem o domínio | que produto é, quais telas chegaram, quais faltam |

A sondagem transforma a pergunta sobre jornadas de **aberta** ("quais são as jornadas?") em **fechada** ("encontrei estas rotas: /, /planos, /checkout, /conta — quais compõem a jornada crítica, e em que ordem?"). Essa conversão é o que impede você de inventar um domínio.

### 0b. Pergunte só o que sobrou — pelo canal certo

O que a sondagem não respondeu, pergunte **uma vez, em bloco**. Quatro coisas importam:

1. **Jornadas críticas em ordem** — agora com as rotas reais como base.
2. **Quem usa e com que familiaridade** — novato eventual? operador diário?
3. **Acesso** — credenciais de teste, se houver login.
4. **Distribuição de tráfego entre breakpoints** — quase ninguém oferece espontaneamente, e domina a priorização.

**Regra do canal.** Um seletor de opções só serve para perguntas cujas alternativas você conhece **sem conhecer o produto**: modo de acesso (URL / repo / prints), viewports, formato de saída. Ele exige rótulos concretos por construção — e para uma pergunta aberta, o único jeito de preencher os rótulos é inventar. Jornadas, domínio e público vão em **texto**, onde uma suposição pode aparecer marcada como suposição ("presumi X pelo nome do repo — confirma?"). No seletor, a opção inventada tem a mesma autoridade visual da real, e o marcador epistêmico se perde.

Se o usuário não souber a distribuição de tráfego, assuma mobile-first (60/40) e **declare a suposição** no relatório — a severidade fica explicitamente condicional em vez de falsamente precisa.

## Passo 1 — Modo de captura define o teto de evidência

Escolha o modo pelo que existe, e **declare no relatório o que aquele modo não permite afirmar**. Preencher lacuna de captura com inferência plausível é a forma número um de fabricação nesse tipo de trabalho.

| Modo | Como | Teto de evidência |
|---|---|---|
| **A. Playwright** (local dev ou URL de preview) | `scripts/capture.py` | Completo: DOM, estilos computados, estados, teclado, foco, sweep de viewport, overflow, latência |
| **B. URL sem browser** | `web_fetch` | Só HTML/estrutura. **Não** afirme nada sobre layout renderizado, alvo de toque, contraste ou estado |
| **C. Prints** | leitura visual | Só o que está no pixel. **Não** afirme nada sobre transição de estado, teclado, foco, hover, latência, nem sobre viewports não enviados |

Prefira sempre o modo A quando houver URL — inclusive para deploys efêmeros da Vercel/AWS. `web_fetch` numa SPA devolve um shell vazio e leva a auditar HTML que o usuário nunca vê.

No modo C, peça os prints faltantes que mais mudariam o resultado (estado de erro, mobile do passo crítico) em vez de auditar só o que chegou. Se o usuário só tem desktop, diga explicitamente que a trilha mobile não foi auditada — **auditar mobile a partir de print de desktop é fabricação**, não inferência.

Leia `references/capture-modes.md` para o protocolo detalhado de cada modo, incluindo login, rotas protegidas e forçar estados.

## Passo 2 — Captura

No modo A, rode a captura antes de qualquer análise:

```bash
python scripts/capture.py --url <URL> --out ./audit-run \
  --viewports 360x740,768x1024,1440x900 \
  [--routes /,/login,/checkout] [--storage-state auth.json] [--wait-selector "main"]

python scripts/checks.py ./audit-run --out ./audit-run/deterministic.json
```

`capture.py` grava, por rota × viewport: screenshot de página inteira, árvore de acessibilidade, e um inventário instrumentado de elementos (caixa delimitadora, cores computadas, foco, rótulo, `inputmode`, `autocomplete`, overflow horizontal, meta viewport).

`checks.py` deriva disso os defeitos **mensuráveis** — contraste, tamanho e espaçamento de alvo, overflow, zoom bloqueado, campo sem rótulo, imagem sem alt, fonte diminuta. Use esses números; não estime a olho o que o script mede. Contraste e tamanho de alvo estimados visualmente erram muito e destroem a credibilidade do relatório inteiro.

O script cobre o mensurável, que é a minoria dos achados. Ele não substitui a inspeção — apenas garante que a parte objetiva esteja certa e liberte sua atenção para o que exige julgamento.

## Passo 3 — Percorra jornada × viewport × estado

Auditar tela por tela é o erro estrutural mais caro, porque as falhas graves vivem **entre** telas: dado perdido no voltar, informação que o usuário precisa carregar na cabeça do passo 2 ao 4, contexto que some no confirmar. Percorra a jornada inteira em ordem primeiro; só depois faça a passagem por elemento.

Cada ponto da jornada é auditado em três dimensões cruzadas:

**Viewport** — no mínimo o menor real, o ponto de virada de layout e o maior. Audite as **fronteiras** de breakpoint (aquele 860px onde ninguém desenhou nada), não o centro confortável de cada faixa. O que muda com o viewport não é só a largura: é o dispositivo de entrada, a rede, a postura do corpo e a atenção disponível. Ver `references/responsive.md` para o que só aparece nessa dimensão.

**Estado** — vazio, carregando, erro, parcial, conteúdo longo demais, sem permissão, offline, primeira vez vs. recorrente. A maioria das auditorias vê só o caminho feliz com dados de demonstração bem-comportados; a maioria dos abandonos acontece nos outros.

**Lente** — faça passagens independentes e só consolide no fim; consolidar cedo faz uma lente contaminar a outra e você encontra uma fração pequena dos problemas:
- *novato descobrindo* — o que é clicável? o que acontece se eu clicar?
- *recorrente com pressa* — quantos passos para a tarefa que faço 40x por dia?
- *quem errou* — dá para perceber, entender e desfazer?
- *quem interrompeu e voltou* — o estado sobreviveu?

Registre a **matriz de cobertura**: o que foi visto e o que não foi. Ela vai no relatório.

## Passo 4 — Derive achados: evidência primeiro, mecanismo depois

Esta é a regra que mais separa auditoria útil de teatro:

> **Nunca varra a lista de princípios procurando um achado para cada um.**

Cobertura forçada de framework é a origem número um de achado inventado. Um relatório com exatamente dez itens, um por heurística de Nielsen, é sintoma de fabricação — não de rigor.

O caminho correto é o inverso, e sempre nesta ordem:

1. **Observe** algo concreto na interface.
2. **Nomeie o custo** para o usuário (hesitação, erro, retrabalho, abandono).
3. **Só então** identifique o mecanismo que explica o custo.

Use `references/mechanisms.md` como **índice de sintoma → mecanismo**, jamais como checklist a percorrer. Ele existe para você explicar por que algo que você já viu machuca — e para reconhecer sintomas que passariam batidos —, não para gerar achados.

Todo achado carrega o **locus**: jornada, passo, viewport, estado, elemento. Se você não consegue apontar onde, o achado não existe — apague.

Corolário sobre o próprio auditor: **interface bonita recebe auditoria mais leniente** (efeito estética-usabilidade). Avalie conclusão de tarefa e estados de falha *antes* de olhar para estética, e mantenha julgamento de gosto numa categoria separada, nunca como defeito.

## Passo 5 — Severidade calculada, não sentida

Sem função explícita, a saída vira lista plana que não fecha decisão nenhuma. Derive cada nota de fatores declarados:

**Severidade (0–4) = f(frequência × impacto × persistência), ponderada por tráfego do breakpoint**

- **Frequência** — quantos usuários passam por ali, e quantas vezes na jornada.
- **Impacto** — hesitação → erro recuperável → erro com perda de dado/dinheiro → bloqueio total.
- **Persistência** — resolve sozinho na segunda vez, ou trava sempre?
- **Peso do breakpoint** — um defeito só de mobile num produto com 70% de mobile é **crítico**, não "questão de mobile". Aplicar esse peso é o que impede a auditoria de espelhar o viés do desktop de quem audita.

| Nota | Significado | Decisão |
|---|---|---|
| 4 | Bloqueia a tarefa para uma fatia relevante | Corrigir antes de lançar |
| 3 | Causa erro ou perda recorrente | Próximo ciclo |
| 2 | Custa tempo e confiança, contornável | Backlog priorizado |
| 1 | Atrito cosmético | Quando tocar na área |
| 0 | Divergência de gosto, não defeito | Não é achado — corte |

Quando um fator não for conhecível por inspeção, diga qual é e o que você assumiu.

## Passo 6 — Consolide

**Achados repetidos viram um achado sistêmico** com lista de ocorrências. Trinta violações do mesmo componente são *um* problema de design system; tratá-las como trinta itens esconde a causa e infla o relatório com trabalho falso.

**Separe em trilhas**, mesmo quando o mesmo elemento aparece em várias: `usabilidade`, `acessibilidade`, `microcópia`, `desempenho percebido`. Os donos da correção, o critério de aceite e o peso são diferentes — acessibilidade tem peso normativo (WCAG) e às vezes jurídico. Fundir tudo em "problemas de UX" faz o item acionável desaparecer dentro do item opinativo.

## Passo 7 — Saída

Entregue **dois arquivos** (não só prosa no chat — o resultado precisa virar backlog):

- `auditoria-ux-<produto>-<data>.md` — cabeçalho curto (escopo, modo de captura, matriz de cobertura, lacunas declaradas) seguido do backlog ordenado por severidade.
- `findings.json` — os mesmos achados em formato importável para Jira/Linear/ClickUp.

Cada achado tem cinco campos e **nenhuma prosa em volta**. Se um deles não puder ser preenchido, o achado ainda não está pronto:

```
UX-014 · [severidade 3] · [trilha: usabilidade] · [sistêmico: 6 ocorrências]
Título curto e factual

EVIDÊNCIA   Onde (jornada/passo/viewport/estado/elemento) + o que se observa.
            Reprodutível por qualquer um que abra a mesma tela.
MECANISMO   Por que custa ao usuário. O princípio é nomeado aqui — e só aqui.
SEVERIDADE  Nota + os fatores que a produziram (incluindo suposições).
CORREÇÃO    A menor mudança que resolve. Não redesenhe quando um ajuste basta.
            Se há trade-off real, dê a alternativa e o critério de escolha.
VERIFICAÇÃO O sinal que diria que funcionou: métrica, teste ou critério de aceite.
```

IDs (`UX-001`…) são estáveis: numa reauditoria, mantenha o ID do achado que persiste. Isso permite medir progresso entre rodadas, que é a única forma de a auditoria virar processo em vez de evento.

Ver `references/report-template.md` para o esqueleto completo e um achado de exemplo.

Os arquivos não encerram o trabalho: siga para o Passo 8.

## Passo 8 — Liste o que precisa mudar, e pare

O relatório diz o que está errado. Ele não fecha o ciclo: alguém ainda precisa ler, decidir e mexer no código. Este passo transforma o backlog em **lista de execução** e devolve a decisão para quem é dono dela.

Apresente a lista **no chat**, não só nos arquivos — ela é o que o usuário lê para autorizar. Uma linha por item, numerada, ordenada por severidade decrescente:

```
[ ] UX-014 · sev 3 · usabilidade
    O QUÊ   Padronizar o verbo destrutivo em "Excluir" nas 6 ocorrências.
    POR QUÊ Três termos para a mesma operação destrutiva: o usuário verifica
            antes de clicar, e o clique errado custa dado. (Consistência, Nielsen 4)
    ONDE    src/components/ui/DeleteButton.tsx +5 — ver findings.json
```

O **POR QUÊ é obrigatório e sai comprimido do `MECANISMO` + o fator que produziu a nota**. Não reescreva o relatório: uma lista que só diz "o quê" vira ordem de serviço sem critério, e quem aplica não consegue julgar quando a correção está errada para aquele caso.

### Três baldes, porque nem tudo é aplicável

Misturar os três é o que faz o usuário autorizar coisa que ninguém podia executar:

| Balde | O que entra | O que o usuário decide |
|---|---|---|
| **Aplicável agora** | defeito com correção localizada e sem escolha em aberto | autorizar ou não |
| **Precisa de decisão sua** | trade-off real declarado no campo `CORREÇÃO`, ou escolha de produto | qual alternativa, antes de qualquer código |
| **Não se corrige, se testa** | toda hipótese | com quem testar, quando |

O terceiro balde **nunca** vira código. Uma hipótese aplicada como se fosse defeito é exatamente a fabricação que o Passo 4 existe para impedir, agora com o agravante de já estar no repositório. Liste-o para que o usuário veja o que ficou de fora e por quê, não para que ele autorize.

Severidade 0 não entra em balde nenhum: já foi cortada no Passo 5.

### O portão

**Não altere nada antes da autorização.** Termine a lista e pare. O usuário aprova tudo, aprova por ID (`UX-014, UX-021`), ou recusa — e recusa é resposta completa, não convite para argumentar.

Se ele autorizar um item do balde "precisa de decisão", peça a decisão primeiro; a alternativa escolhida muda a correção, e adivinhá-la desperdiça o trabalho dos dois.

### Aplicação

Autorizado, aplique **uma mudança por achado** — a menor que resolve, que é o que o campo `CORREÇÃO` já obriga. Não aproveite a passagem para refatorar o arquivo: uma correção que vem embrulhada em outras mudanças não pode ser revertida sozinha nem verificada isoladamente.

Respeite as convenções do repositório onde elas existirem (`CLAUDE.md`, `CONTRIBUTING`, lint, testes). A auditoria não tem autoridade sobre elas.

### Reverificação — a parte que não é opinião

Ao terminar, **rode a captura de novo** e compare:

```bash
python scripts/capture.py --url <URL> --out ./audit-run-2 --viewports <os mesmos>
python scripts/checks.py ./audit-run-2 --out ./audit-run-2/deterministic.json
```

Confronte cada item com o seu campo `VERIFICAÇÃO` e marque:

- **corrigido** — a medição confirma (contraste era 2.8:1, agora é 4.7:1), ou o critério de aceite é verificável e está satisfeito.
- **parcial** — melhorou sem atingir o critério. Diga quanto faltou, em número.
- **não** — tentado e não resolvido. Diga o que impediu; isso costuma ser um achado novo.

Para o que `checks.py` mede, **o número é a resposta** — não declare corrigido por ter editado o arquivo. Para o que ele não mede, o critério de aceite do `VERIFICAÇÃO` é o que decide, e se ele não for verificável agora, diga isso em vez de marcar corrigido.

Atualize `status` em `findings.json` e preserve os IDs: é o que faz a próxima rodada medir progresso em vez de recomeçar.

## Auto-verificação antes de entregar

Passe esta lista na saída pronta. Cada item corresponde a um modo de falha que já arruinou auditorias reais:

- [ ] Alguma pergunta que fiz ao usuário continha um domínio, jornada ou público que eu inventei? → esse dado é suposição declarada, não base do relatório.
- [ ] Existe algum achado que eu não consigo localizar num pixel específico? → apague.
- [ ] O número de achados bate suspeitosamente com o número de princípios? → provavelmente inventei alguns.
- [ ] Afirmei algo que meu modo de captura não permite observar? → volte para o Passo 1.
- [ ] Alguma hipótese está redigida com a confiança de um defeito? → reclassifique.
- [ ] O mesmo problema aparece como N itens? → consolide em sistêmico.
- [ ] Alguma severidade 3–4 sem os fatores declarados? → mostre a conta.
- [ ] Alguma correção é "redesenhar a página"? → encontre a menor mudança que resolve.
- [ ] Auditei estados de falha e vazio, ou só o caminho feliz?
- [ ] A trilha mobile tem evidência própria, ou inferi do desktop?
- [ ] Existe achado que é só preferência estética minha? → nota 0, corte.
- [ ] Algum item da lista de execução sem o POR QUÊ? → quem aplica não tem critério para julgar; complete.
- [ ] Alterei algum arquivo antes da autorização, ou apliquei uma hipótese? → reverta e volte ao Passo 8.
- [ ] Marquei algo como corrigido sem a medição ou o critério de aceite confirmar? → é "parcial" até a conta fechar.

## Arquivos de apoio

- `references/capture-modes.md` — sondagem, subida de dev server local, protocolo por modo (Playwright, URL, prints), login, como forçar estados.
- `references/responsive.md` — o que só aparece na dimensão viewport; sintomas específicos de web responsiva.
- `references/mechanisms.md` — índice **sintoma → mecanismo** (Nielsen, Laws of UX, Gestalt, WCAG). Consulta, nunca checklist.
- `references/report-template.md` — esqueleto do relatório e exemplo de achado bem escrito.
- `scripts/capture.py` — captura instrumentada via Playwright.
- `scripts/checks.py` — defeitos mensuráveis a partir da captura.
