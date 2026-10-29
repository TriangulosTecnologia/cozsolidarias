# Etapa 0: caso selecionado

id: nogolden-pessoas-atendidas-quero-ver
prompt: Quero ver o número total de pessoas atendidas pelas cozinhas solidárias por município
expect: 

```json
{"dataset":"cozinhas_pessoas_atendidas","variable":"pessoasAtendidas","form":"point+sizeBy","legendScale":"quantitative","total":{"source":"gateway.getCozinhasPorMunicipio","field":"pessoasAtendidas","tolerance":0}}
```

golden: _pessoas-atendidas.json
fonte: evals/evals.json (campo default=true)
