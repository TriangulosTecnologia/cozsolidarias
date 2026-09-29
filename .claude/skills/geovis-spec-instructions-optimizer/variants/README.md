# Variantes candidatas

Propostas do Passo 1, prontas para o Passo 2/4. **Nada aqui foi medido ainda** — são hipóteses
com justificativa, não conclusões.

| Arquivo | O que é | Tokens |
|---|---|---|
| `justificativa.md` | O raciocínio: por que `INSTRUCTIONS` não é alvo, o que no agente é, e em que ordem medir | — |
| `agente-tier1.md` | Só os cortes seguros + a correção do `sizeBy` corrompido | ~3.014 (−563, −16%) |
| `agente-tier12.md` | Tier 1 mais os cortes de risco médio | ~2.895 (−682, −19%) |

Ambas geradas por `scripts/build_agent_variant.mjs <tier>`, nunca redigitadas — o script falha
alto se um marcador não for encontrado, em vez de emitir uma variante silenciosamente errada.
Regenere depois de qualquer edição no prompt de origem.

## Ordem da primeira campanha

1. **Corrigir o `sizeBy` corrompido no prompt de produção primeiro.** Medir poda contra um
   controle corrompido mede a corrupção. A correção está isolada em `fix-sizeby` justamente para
   poder ir sozinha.
2. `atual-sem-poda` (controle, obrigatório) → `agente-tier1` → `agente-tier12`, sempre
   serializados: o `system` é sobrescrito no mesmo agente de teste.
3. Gate de cobertura antes de qualquer eixo de eficiência. Regressão em qualquer caso `R-*`
   descarta a variante.

## O que não está aqui, e por quê

Nenhuma variante podada de `INSTRUCTIONS`. O docstring de `instructions.ts` declara que a
redundância com os validadores é deliberada — o validador vira 422 que o usuário absorve, a
instrução evita o erro. Propor poda ali exige evidência de eval contra uma decisão escrita, não
leitura de redundância. A única mudança proposta naquele lado é factual: a afirmação *"esta
aplicação não serve tile server"* é falsa (produção serve `/tiles/caf-h3-*`), e a justificativa
correta é que essas URLs não são expostas ao agente.

O corte `source-type-enum` **aumenta** o prompt em ~8 tokens. Está no Tier 1 mesmo assim: o valor
dele é remover cinco tipos de source que o agente não pode usar, não economizar tokens.
