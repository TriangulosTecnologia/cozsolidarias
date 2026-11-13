# A dimensão viewport

O que muda com a largura não é só a largura. Muda o **dispositivo de entrada** (toque grosso vs. ponteiro fino), a **rede**, a **postura do corpo** (uma mão, em movimento, com pressa) e a **atenção disponível**. Quase tudo desta página é invisível na inspeção desktop — e é por isso que a auditoria de responsividade precisa de evidência própria, nunca inferida.

## Onde olhar: as fronteiras

Audite alguns pixels **abaixo e acima** de cada breakpoint declarado, não o centro confortável de cada faixa. O vão entre duas regras de media query — aquele 860px onde ninguém desenhou nada — concentra os defeitos. Se o produto declara breakpoints em 768 e 1024, olhe 767/769 e 1023/1025.

Teste também o **estado intermediário de rotação** e o navegador com barra de ferramentas visível, que come altura real (`100vh` mente em mobile; `dvh` é o correto).

## Sintomas por categoria

### Entrada e toque
- Afordância que só existe em `:hover` — não existe hover no toque, e o equivalente por foco raramente foi implementado.
- Tooltip como único portador de informação necessária.
- Alvo abaixo de 24px (mínimo WCAG 2.2 AA 2.5.8) ou abaixo de ~44px (conforto real).
- Alvos adjacentes sem espaçamento, sobretudo quando um deles é destrutivo.
- Ação primária fora da zona de alcance do polegar em tela grande.
- Arrastar, deslizar ou pressionar-e-segurar como **único** caminho para uma ação (WCAG 2.5.1 exige alternativa).
- `type`, `inputmode` e `autocomplete` errados: teclado alfabético num campo de CEP, sem sugestão de e-mail salvo.

### Layout e conteúdo
- Overflow horizontal (`scrollWidth > clientWidth`) — quase sempre uma tabela, uma imagem sem `max-width` ou um `min-width` esquecido.
- Tabela larga virando rolagem horizontal com o cabeçalho perdido. Considere transposição em cards no mobile.
- Reordenação de colunas ao empilhar: o que estava lado a lado vira sequência, e o item importante cai no **meio** da lista — a zona de pior retenção (posição serial). O agrupamento por proximidade também se desfaz.
- Conteúdo real quebrando o layout: nome longo, preço de 9 dígitos, tradução alemã, lista de 500 itens. Dados de demonstração são sempre bem-comportados.
- `100vh` cortado pela barra do navegador; usar `100dvh`.
- Zoom de 200% estourando o container (WCAG 1.4.4) — obrigatório, não opcional.
- `user-scalable=no` ou `maximum-scale=1` bloqueando zoom: falha direta de acessibilidade.
- Header ou barra fixa consumindo metade da tela útil com o teclado virtual aberto.

### Navegação
- Menu hambúrguer escondendo a navegação primária inteira, inclusive onde havia espaço.
- Itens do menu desktop que simplesmente somem no mobile em vez de migrar para outro lugar.
- Barra inferior fixa competindo com a barra do sistema operacional.
- Modal em tela cheia no mobile sem saída óbvia (o X fora da área alcançável).

### Formulário
- Campo que rola para fora da vista quando o teclado abre.
- Botão de envio coberto pelo teclado virtual.
- Máscara que rejeita colagem — a forma mais comum de violar a Lei de Postel no mobile.
- Erro exibido acima do campo, fora da tela visível quando o teclado está aberto.

### Desempenho percebido
- Deslocamento de layout durante o carregamento (CLS): o usuário toca no lugar errado porque o conteúdo se moveu.
- Fonte que carrega tarde e reflui todo o texto.
- Imagem sem dimensão reservada.
- Peso de bundle irrelevante no Wi-Fi do escritório e decisivo no 4G instável, onde o mobile de fato é usado.

## Peso na severidade

Aplique a distribuição real de tráfego entre breakpoints. Um defeito exclusivo de mobile num produto com 70% de acessos mobile é **crítico** — não "questão de mobile", que é como a maioria dos relatórios o rebaixa por reflexo de quem audita no desktop.

Se a distribuição for desconhecida, assuma mobile-first e declare a suposição. É melhor errar superestimando o mobile do que reproduzir o viés do auditor.
