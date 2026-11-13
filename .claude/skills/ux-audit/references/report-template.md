# Esqueleto do relatório

O corpo do documento **é** o backlog ordenado por severidade. O cabeçalho é curto e existe para dizer o que foi olhado e o que não foi.

---

```markdown
# Auditoria de UX — <Produto> · <data>

## Escopo
- **Jornadas auditadas:** <lista em ordem>
- **Público assumido:** <perfil e familiaridade>
- **Modo de captura:** <A Playwright | B URL | C prints | combinado>
- **Viewports:** <lista> · **Tráfego assumido:** <ex.: 70% mobile — informado pelo cliente / suposição>

## Cobertura

| Jornada / passo | 360px | 768px | 1440px | Vazio | Erro | Carregando | Teclado |
|---|---|---|---|---|---|---|---|
| Cadastro → e-mail | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ |
| Checkout → pagamento | ✅ | ❌ | ✅ | ✅ | ❌ | — | ❌ |

✅ auditado · ❌ não auditado · — não aplicável

## Lacunas declaradas
<O que este modo de captura não permite afirmar. Sem isso, o leitor lê silêncio como aprovação.>
Ex.: "Sem evidência de mobile real no checkout: só temos prints de desktop. Comportamento de
teclado virtual, foco e latência não foram observados em nenhuma jornada."

## Resumo
<3–5 linhas. O padrão que atravessa os achados, não uma contagem deles.>
- Bloqueadores (sev. 4): N · Alta (3): N · Média (2): N · Baixa (1): N
- Sistêmicos: N achados cobrindo M ocorrências

---

## Defeitos — corrigir

<Achados ordenados por severidade decrescente, no formato de cinco campos.>

## Hipóteses — testar

<Cada uma com: o que suspeitamos, com quem testar, por qual método, qual critério decide.>

## Fora de escopo
<O que foi notado mas é preferência estética (sev. 0), decisão de produto, ou dependência
técnica fora do controle da equipe. Listar aqui evita que volte como achado na próxima rodada.>

## Plano de correção
<A lista do Passo 8, repetida aqui para o relatório fechar sozinho. Três baldes; o
POR QUÊ é obrigatório em cada linha. Status preenchido só depois da reverificação.>

### Aplicável agora
| # | ID | O quê | Por quê | Onde | Status |
|---|---|---|---|---|---|
| 1 | UX-014 | Padronizar o verbo em "Excluir" (6 ocorrências) | Três termos para a mesma operação destrutiva; o clique errado custa dado (Nielsen 4) | `DeleteButton.tsx` +5 | corrigido |
| 2 | UX-021 | Alvo de 24→44px no filtro | 28px no 360, polegar erra o vizinho (Fitts) | `FilterChip.tsx` | parcial — 38px |

### Precisa de decisão
| ID | Trade-off | Alternativas | Critério que decide |
|---|---|---|---|

### Não se corrige, se testa
| ID | Hipótese | Com quem | Método | Critério |
|---|---|---|---|---|
```

---

# Anatomia do achado

```
UX-014 · sev 3 · usabilidade · sistêmico (6 ocorrências)
Rótulo de exclusão muda de nome entre telas

EVIDÊNCIA   Checkout/carrinho (360px, estado com itens): botão "Remover".
            Conta/endereços (360px): "Excluir". Projeto/membros (1440px): "Apagar".
            Todos executam a mesma operação destrutiva.
            +3 ocorrências em ./audit-run/deterministic.json → dup_labels
MECANISMO   Consistência (Nielsen 4): o usuário precisa verificar se três termos designam a
            mesma operação. Em ação destrutiva, a dúvida gera hesitação ou clique errado —
            e o custo do clique errado aqui é perda de dado.
SEVERIDADE  3 = frequência alta (toda jornada de gestão) × impacto erro-com-perda ×
            persistência total (não se resolve com uso) × 70% mobile, onde o alvo é menor.
CORREÇÃO    Padronizar em "Excluir" no design system e substituir nas 6 ocorrências.
            Trade-off: "Remover" é preferível quando a ação é reversível — se algum desses
            fluxos tem desfazer, mantenha a distinção e documente-a.
VERIFICAÇÃO Nenhum outro verbo destrutivo no inventário de microcópia; taxa de exclusão
            acidental (via desfazer/suporte) medida antes e depois.
```

## O que faz um achado ruim

**Sem locus** — "a navegação é confusa". Não localizável, não corrigível, não é achado.

**Mecanismo no lugar da evidência** — "viola a Lei de Hick". Isso é a explicação, não a observação. O leitor precisa saber *o que está na tela* antes de saber qual princípio explica o custo.

**Correção maior que o problema** — "redesenhar o fluxo de checkout" quando o defeito é um botão de 20px. Encontre a menor mudança que resolve.

**Severidade sem conta** — "alta". Mostre os fatores; a nota precisa ser contestável.

**Hipótese vestida de defeito** — "os usuários não entendem o ícone". Você não sabe: ninguém foi observado. Redija como hipótese, com o teste que decidiria.

**N itens para um problema** — trinta violações do mesmo componente são um problema de design system. Consolide em sistêmico com a lista de ocorrências.

---

# findings.json

Mesmos achados, formato importável. Um objeto por achado:

```json
{
  "audit": { "product": "…", "date": "2026-09-04", "capture_mode": "A", "viewports": ["360x740","1440x900"] },
  "findings": [
    {
      "id": "UX-014",
      "title": "Rótulo de exclusão muda de nome entre telas",
      "kind": "defect",
      "track": "usability",
      "severity": 3,
      "severity_factors": { "frequency": "high", "impact": "error_with_loss", "persistence": "permanent", "breakpoint_weight": "mobile_70" },
      "systemic": true,
      "occurrences": [
        { "journey": "checkout", "step": "carrinho", "viewport": "360x740", "state": "com itens", "element": "button.remove-item", "observed": "rótulo 'Remover'" }
      ],
      "mechanism": "Consistência (Nielsen 4) — …",
      "fix": "Padronizar em 'Excluir' no design system…",
      "verification": "Inventário de microcópia sem outro verbo destrutivo…",
      "evidence_source": "playwright",
      "assumptions": ["distribuição 70/30 mobile informada pelo cliente"],
      "fix_scope": "agent",
      "status": "pending"
    }
  ]
}
```

Campos de `kind`: `defect` | `hypothesis`. De `track`: `usability` | `accessibility` | `microcopy` | `perceived_performance`.

`fix_scope` diz de qual balde do Passo 8 o achado é, e é o que impede o usuário de autorizar
o que ninguém podia executar: `agent` (correção localizada, aplicável), `product_decision`
(trade-off ou escolha aberta — decisão antes de código) ou `test_only` (hipótese; nunca vira
código). Toda hipótese é `test_only`, sem exceção.

`status` atravessa as rodadas junto com o ID: `pending` → `authorized` → `fixed` | `partial` |
`failed`, ou `declined` quando o usuário recusou. Só marque `fixed` com a medição da
reverificação ou o critério de aceite confirmando; `partial` carrega o número que faltou.

Mantenha os IDs estáveis entre rodadas: um achado que persiste conserva seu ID. É o que transforma auditoria em processo mensurável em vez de evento isolado.
