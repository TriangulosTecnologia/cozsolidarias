# Índice sintoma → mecanismo

**Como usar:** você já observou algo. Procure o sintoma, leia o mecanismo, escreva a explicação com suas palavras.

**Como não usar:** percorrendo de cima a baixo à procura de achados. Esta é a diferença entre auditoria e teatro de auditoria. Se um mecanismo daqui não corresponde a nada que você viu na tela, ele não vira achado.

O uso secundário legítimo é de **reconhecimento**: ler a coluna de sintomas ajuda a perceber, na próxima passagem pela interface, coisas que passariam batidas. Mas o achado ainda precisa nascer da observação.

Índice: [Orientação](#1-orientação-e-estado) · [Decisão](#2-encontrar-e-decidir) · [Ação](#3-agir) · [Erro](#4-errar-e-recuperar) · [Memória](#5-lembrar-e-voltar) · [Percepção](#6-agrupamento-e-leitura-visual) · [Linguagem](#7-linguagem-e-modelo-mental) · [Sistema](#8-arquitetura-e-decisões-de-sistema) · [Ética](#9-fronteira-ética)

---

## 1. Orientação e estado

| Sintoma observado | Mecanismo | O que verificar em seguida |
|---|---|---|
| Ação sem retorno visível; usuário clica duas ou três vezes | **Visibilidade do status** (Nielsen 1) | Existe estado `loading`/`disabled`? A ação é idempotente no backend? |
| Espera acima de ~400ms sem sinal | **Limiar de Doherty** | Cabe skeleton, UI otimista ou animação que ocupe a espera? Meça o tempo real. |
| Espera longa sem noção de progresso ou fim | **Visibilidade + Efeito Zeigarnik** | Progresso determinado é possível? Indeterminado prolongado é lido como travamento. |
| Processo em várias etapas sem indicação de onde estou | **Visibilidade + Chunking** | Stepper existe? Mostra total de passos? Permite voltar? |
| Salvamento automático sem confirmação | **Visibilidade** | O usuário tem alguma razão para acreditar que o dado foi salvo? |
| Interrupção (modal, notificação) em tarefa concentrada | **Fluxo** | Podia ser não-modal, adiado ou inline? |

## 2. Encontrar e decidir

| Sintoma observado | Mecanismo | O que verificar em seguida |
|---|---|---|
| Menu ou lista com muitas opções irmãs, sem hierarquia | **Lei de Hick** (tempo cresce com nº e complexidade das opções) | Cabe categorizar, revelar progressivamente ou destacar recomendado? |
| Grade de planos/produtos que trava a decisão | **Sobrecarga de escolha** | Diferente de Hick: aqui o custo é ansiedade e abandono, não milissegundos. Existe padrão pré-selecionado e comparação estruturada? |
| Vários CTAs com o mesmo peso visual na mesma tela | **Efeito Von Restorff** (o diferente é o lembrado) | Qual é a ação primária? Destacar tudo é não destacar nada. Cor sozinha não basta (WCAG 1.4.1). |
| Item importante no meio de lista longa | **Efeito de posição serial** (primazia e recência) | O meio é a zona de menor retenção. Dá para mover para as pontas? |
| Conteúdo legítimo com aparência de anúncio sendo ignorado | **Atenção seletiva** / cegueira de banner | Formato, posição e cor estão imitando publicidade? |
| Tela inicial com muitos elementos competindo | **Design minimalista** (Nielsen 8) + **Navalha de Occam** | Cada elemento justifica sua existência? Remova até quebrar e devolva o último. |
| Funcionalidade existe mas ninguém acha | **Hipótese de descoberta**, não defeito | Isto é hipótese: só teste com usuário decide. Redija como tal. |

## 3. Agir

| Sintoma observado | Mecanismo | O que verificar em seguida |
|---|---|---|
| Alvo de toque pequeno, ou pequeno e distante | **Lei de Fitts** (tempo = f(distância, tamanho)) | Medido por `checks.py`. Mínimo WCAG 2.2 AA: 24px; recomendado 44px. Área clicável pode exceder o desenho visível. |
| Alvos adjacentes colados | **Fitts + prevenção de erros** | Espaçamento suficiente para não errar o vizinho, sobretudo em ação destrutiva. |
| Ação primária fora da zona de alcance do polegar no mobile | **Fitts + postura de uso** | Ação frequente deve estar na metade inferior em telas grandes. |
| Afordância que só existe no `:hover` | **Descoberta + entrada por toque** | Não existe hover no toque. Há equivalente permanente ou por foco? |
| Tooltip como único portador de informação necessária | **Reconhecimento vs. memorização** + toque | A informação essencial precisa estar visível, não sob hover. |
| Usuário experiente repete a mesma sequência longa | **Flexibilidade e eficiência** (Nielsen 7) | Cabe atalho, ação em lote, repetir última, favorito? |
| Formulário longo pedindo dado que o sistema já tem | **Carga cognitiva** + **Lei de Postel** | Preencher automaticamente. Aceitar formatos variados e normalizar internamente. |
| Campo rejeita entrada por formatação (espaço, parêntese, máscara) | **Lei de Postel** (liberal no que aceita) | Normalize no código, não no usuário. Colar deve funcionar. |
| Teclado errado no mobile (texto em campo numérico) | **Postel + eficiência** | `inputmode`, `type`, `autocomplete` — medido por `checks.py`. |

## 4. Errar e recuperar

| Sintoma observado | Mecanismo | O que verificar em seguida |
|---|---|---|
| Erro possível que o design poderia impedir | **Prevenção de erros** (Nielsen 5) | Distinga *slip* (desatenção → restrinja, dê padrão) de *mistake* (modelo mental errado → esclareça o conceito). |
| Ação destrutiva sem confirmação nem desfazer | **Controle e liberdade** (Nielsen 3) | Desfazer é melhor que confirmar: confirmação vira reflexo e para de proteger. |
| Mensagem com código interno ou jargão | **Reconhecer, diagnosticar, recuperar** (Nielsen 9) + **Correspondência com o mundo real** (Nielsen 2) | Linguagem simples, problema preciso, saída construtiva. |
| Erro exibido longe do campo que o causou | **Nielsen 9 + Proximidade** | Erro deve aparecer junto ao locus, e ser anunciado a leitor de tela. |
| Validação só no envio de formulário longo | **Nielsen 5 + Carga cognitiva** | Validar no blur do campo; nunca a cada tecla, que pune quem ainda está digitando. |
| Fluxo em etapas sem voltar | **Controle e liberdade** | Voltar preserva o que já foi digitado? Este é o defeito clássico entre telas. |
| Voltar do navegador quebra o estado da SPA | **Lei de Jakob** + controle | Convenção externa: o botão voltar do navegador deve funcionar. |
| Sessão expira e o trabalho se perde | **Controle + Zeigarnik** | Rascunho persistido? Reautenticação sem descartar contexto? |

## 5. Lembrar e voltar

| Sintoma observado | Mecanismo | O que verificar em seguida |
|---|---|---|
| Dado exibido numa tela é exigido em outra | **Reconhecimento vs. memorização** (Nielsen 6) + **Memória de trabalho** | O achado mais comum e mais ignorado das auditorias por tela. Carregue o dado adiante. |
| Sequência longa de dígitos sem agrupamento | **Chunking** / **Lei de Miller** | Miller fala de *chunks*, não de itens de menu — não use "7±2" para limitar navegação. |
| Confirmação de compra/pedido sem resumo do que foi feito | **Memória de trabalho + Regra do pico-fim** | O fim da jornada desproporcionalmente define a lembrança da experiência inteira. |
| Momento de pico negativo (erro de pagamento, espera longa) sem reparo | **Regra do pico-fim** | Investir no pico e no fim rende mais que melhorar tudo uniformemente. |
| Cadastro longo antes de qualquer valor entregue | **Paradoxo do usuário ativo** + **Gradiente de meta** | Ninguém lê manual nem investe antes do valor. Progresso inicial já concedido acelera a conclusão. |
| Tarefa longa sem sinal de quanto falta | **Gradiente de meta + Zeigarnik** | Progresso visível puxa para a conclusão. |
| Onboarding longo antes do primeiro uso | **Paradoxo do usuário ativo** | Ajuda contextual no ponto de uso rende; tour inicial é pulado. |

## 6. Agrupamento e leitura visual

| Sintoma observado | Mecanismo | O que verificar em seguida |
|---|---|---|
| Rótulo mais perto do campo errado | **Lei da Proximidade** | O espaçamento comunica relação antes de qualquer cor ou linha. |
| Elementos clicáveis e não clicáveis com aparência igual | **Lei da Similaridade** | Se é clicável, deve parecer com os outros clicáveis — e diferente do resto. |
| Card/borda agrupando coisas não relacionadas | **Lei da Região Comum** | Uma fronteira definida vence a proximidade. Não agrupe por conveniência de layout. |
| Linha, seta ou barra ligando coisas independentes | **Conectividade uniforme** | A mais forte das leis de agrupamento: domina proximidade e similaridade. |
| Ícone ou forma ambígua interpretada errado | **Lei de Prägnanz** | A leitura mais simples vence. Rótulo textual resolve mais barato que redesenho. |
| Reordenação de colunas no mobile separa o que estava junto | **Proximidade + posição serial** | Ver `responsive.md` — o item importante cai no meio da lista empilhada. |
| Texto pequeno, cinza-claro ou sobre imagem | **Contraste (WCAG 1.4.3)** | Medido por `checks.py`. É trilha de acessibilidade, não de gosto. |

## 7. Linguagem e modelo mental

| Sintoma observado | Mecanismo | O que verificar em seguida |
|---|---|---|
| Rótulo com vocabulário interno da engenharia | **Correspondência com o mundo real** (Nielsen 2) | "Persistir entidade" vs. "Salvar rascunho". |
| Termos diferentes para a mesma coisa entre telas | **Consistência** (Nielsen 4) | "Excluir", "Remover", "Apagar" no mesmo produto. Quase sempre é achado **sistêmico**. |
| Padrão de interface que diverge do que o mercado faz | **Lei de Jakob** | Inovar em convenção gasta orçamento de aprendizado. Gaste na proposta de valor, não no ícone de carrinho. |
| Comportamento que contradiz o que o usuário espera do domínio | **Modelo mental** | Aproximar o modelo do sistema do modelo do usuário é mais barato que ensinar um novo. |
| Ajuda existe mas é genérica e longe da tarefa | **Ajuda e documentação** (Nielsen 10) | Focada na tarefa, com passos concretos, no ponto de uso. |
| Microcópia que descreve o sistema, não a ação do usuário | **Nielsen 2** | Botão nomeia o que vai acontecer ("Enviar convite"), não "OK". |

## 8. Arquitetura e decisões de sistema

| Sintoma observado | Mecanismo | O que verificar em seguida |
|---|---|---|
| Simplificação da interface empurrou trabalho para o usuário | **Lei de Tesler** (conservação da complexidade) | A pergunta não é "como eliminar" mas "quem paga". Deve pagar o sistema — sem tirar controle de quem precisa dele. |
| Recurso raro ocupando espaço nobre | **Princípio de Pareto** | Uma minoria de funções concentra a maioria do uso. Identifique por dado, não por intuição. |
| Muitas funções, nenhuma boa | **Occam + Pareto** | Cada uma justifica seu custo de manutenção e de atenção? |
| Interface bonita mascarando fluxo quebrado | **Efeito estética-usabilidade** | Vale para o usuário *e para você*: audite tarefa e falha antes de estética. |
| Tarefa que se arrasta sem prazo ou limite visível | **Lei de Parkinson** | Expectativa de tempo declarada ("2 minutos") acelera em vez de estressar. |

## 9. Fronteira ética

Os mecanismos de 4, 5 e 6 são simétricos: o que reduz atrito também fabrica pressão. **Vieses cognitivos** explicam por que dark patterns funcionam, e nomeá-los é responsabilidade da auditoria, não território fora de escopo.

Registre como achado quando encontrar: urgência ou escassez falsa, opção de recusa escondida ou com contraste rebaixado, consentimento pré-marcado, cancelamento mais difícil que assinatura, custo revelado só no último passo, confirmshaming.

Classifique na trilha **usabilidade** com nota de severidade normal — mas descreva o mecanismo como manipulação explícita. Vários desses são infração de LGPD ou do Código de Defesa do Consumidor no Brasil; quando for o caso, aponte a exposição sem opinar sobre mérito jurídico.
