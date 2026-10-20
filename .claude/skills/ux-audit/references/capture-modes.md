# Protocolo por modo de captura

O modo determina o que você pode afirmar. Declare o teto no cabeçalho do relatório antes do primeiro achado — quem lê precisa saber o que **não** foi olhado, ou vai assumir que o silêncio significa aprovação.

---

## Sondagem (Passo 0) — o mesmo comando, um viewport, só a home

```bash
python scripts/capture.py --url <URL> --out ./probe --viewports 360x740 --routes /
```

O console imprime título e as rotas internas encontradas. Use-as para propor jornadas ancoradas no produto real em vez de inventar um domínio. Não analise nada ainda — a sondagem existe para perguntar melhor, não para auditar.

---

## Modo A — Playwright (local dev ou URL de preview)

O modo preferido sempre que houver URL acessível, inclusive deploys efêmeros (Vercel, Netlify, Amplify, Cloud Run, ngrok, `localhost:3000`).

### Repo local: subir o dev server

O caso mais comum. Descubra o comando em `package.json` → `scripts` (`dev`, `start`, `serve`) ou no README; instale dependências se `node_modules` não existir. Suba em segundo plano e espere a porta antes de capturar:

```bash
npm run dev > /tmp/dev.log 2>&1 &
for i in $(seq 1 30); do curl -sf http://localhost:3000 >/dev/null && break; sleep 1; done
python scripts/capture.py --url http://localhost:3000 --out ./audit-run ...
```

A porta real está no log (`/tmp/dev.log`) se não for 3000. Se o app depende de backend ou variáveis de ambiente que não existem, pergunte antes de tentar contornar — auditar uma tela de erro de configuração produz achados sobre o ambiente, não sobre o produto.

Vantagem exclusiva deste modo: com o código à mão, a lista de rotas vem da pasta de roteamento (`app/`, `pages/`, `routes/`) e é completa — inclusive as que não aparecem na navegação.

### Instalação

```bash
pip install playwright && playwright install chromium
```

Se o `playwright install` falhar por falta de dependências de sistema, tente `playwright install --with-deps chromium`. Sem sucesso, degrade para o modo C usando prints do usuário — e **diga que degradou**, em vez de auditar em cima de HTML cru.

### Execução

```bash
python scripts/capture.py --url https://preview-abc.vercel.app --out ./audit-run \
  --viewports 360x740,768x1024,1440x900 \
  --routes /,/pricing,/signup
python scripts/checks.py ./audit-run --out ./audit-run/deterministic.json
```

Escolha de viewports: o menor real do público (360 é o piso seguro em 2026; 320 se houver base legada), a **fronteira** de breakpoint onde o layout vira, e o maior comum. Se o usuário informou os breakpoints do design system, audite alguns pixels **abaixo e acima** de cada um — o vão entre regras é onde mora o defeito, não o centro confortável da faixa.

### Rotas protegidas

Peça credenciais de teste. Faça o login uma vez e reaproveite:

```bash
python scripts/capture.py --url <url-login> --login-url <url-login> \
  --login-user <email> --login-pass <senha> --save-storage auth.json
python scripts/capture.py --url <url-app> --storage-state auth.json --routes /app,/app/settings
```

Se os seletores do formulário de login não forem os padrão, passe `--login-user-selector` e `--login-pass-selector`. Nunca peça credencial de produção real; se o usuário oferecer, prefira ambiente de staging.

### Estados que não aparecem sozinhos

O caminho feliz com dados de demonstração é o que a captura pega de graça. O resto exige provocação deliberada — e é onde estão os abandonos:

- **Vazio** — conta nova, filtro sem resultado, busca sem retorno.
- **Erro** — envie formulário em branco, com e-mail inválido, com CPF inválido, com campo no limite de tamanho.
- **Carregando** — `--throttle slow3g` no script, ou DevTools Protocol para latência.
- **Offline / falha de rede** — desligue a rede no meio de um envio.
- **Conteúdo extremo** — nome de 80 caracteres, lista com 500 itens, valor com 9 dígitos, texto em alemão. Quebra de layout por conteúdo real é achado frequente e invisível em dados de demo.
- **Sem permissão** — usuário de papel restrito abrindo rota de admin.
- **Recorrente** — segunda visita, com dado salvo, sessão parcialmente expirada.

Use `--script` para injetar uma sequência Playwright que produza o estado, ou navegue manualmente com o browser em modo headed e capture ao chegar lá.

### Teclado e foco

Percorra a jornada inteira **só com Tab, Shift+Tab, Enter, Espaço e setas**. Isso encontra em minutos: ordem de foco divergente da ordem visual, foco invisível, armadilha de foco em modal, foco perdido depois de fechar overlay, item alcançável por mouse e inalcançável por teclado. Registre na trilha de acessibilidade.

---

## Modo B — URL sem browser (`web_fetch`)

Último recurso. Numa SPA, `web_fetch` devolve um shell praticamente vazio e você acabará auditando HTML que nenhum usuário vê.

Serve apenas para: estrutura de cabeçalhos, presença de `<label>`, `alt`, `lang`, meta viewport, e microcópia em páginas renderizadas no servidor.

**Nunca afirme**, neste modo: qualquer coisa sobre layout renderizado, tamanho de alvo, contraste real, estado, ou comportamento responsivo. Se for o único acesso possível, diga ao usuário que o resultado é uma pré-auditoria estrutural e peça prints ou acesso para Playwright.

---

## Modo C — Prints enviados pelo usuário

Legítimo e frequente. A disciplina aqui é toda sobre não extrapolar.

**Pode afirmar:** hierarquia visual, agrupamento, microcópia, densidade, contraste aparente (como *suspeita*, não medida), consistência entre telas enviadas, informação exigida que não está presente na tela.

**Não pode afirmar:** transição de estado, comportamento do teclado, visibilidade de foco, hover, latência, tamanho real de alvo em px CSS (o print não diz a escala), nem **absolutamente nada** sobre viewports que não foram enviados.

Auditar mobile a partir de print de desktop é fabricação, não inferência. Se só chegou desktop, escreva no relatório: *"trilha mobile não auditada — sem evidência"*.

### O que pedir quando faltar

Peça poucos e específicos, os que mais mudariam o resultado — não uma lista genérica de trinta telas:

1. O passo mais crítico da jornada em **mobile real** (não redimensionamento de janela — a diferença é teclado virtual, toque e rede).
2. Um **estado de erro** de formulário.
3. Um **estado vazio**.
4. A tela de **confirmação/fim** da jornada, que domina a lembrança da experiência inteira.

Se o usuário puder gravar a tela em vez de fotografar, peça o vídeo: ele carrega transição, latência e ordem de ações — recupera boa parte do teto do modo A.

---

## Modos combinados

Comum e desejável: Playwright para a app logada em dev + prints do usuário para o app de produção com dados reais. Marque a origem da evidência **em cada achado**, porque o teto de confiança é por achado, não por relatório.
