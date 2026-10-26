#!/usr/bin/env python3
"""
Defeitos mensuraveis a partir da captura.

Cobre so o que tem numero: contraste, tamanho e espacamento de alvo, overflow,
zoom, rotulo, alt, ordem de foco. Isso e a minoria dos achados de uma auditoria -
o resto exige julgamento. Mas e justamente a parte que se estima errado a olho,
entao rodar isto libera sua atencao para o que so voce pode ver.

Cada item de saida ja vem com locus (rota, viewport, seletor) e o valor medido,
para ir direto ao campo EVIDENCIA do achado. A severidade sugerida e um piso:
recalcule com frequencia, impacto, persistencia e peso do breakpoint.

Uso:
  python checks.py ./audit-run --out ./audit-run/deterministic.json
"""

import argparse
import glob
import json
import os
import re
import sys
from collections import defaultdict

# ---------------------------------------------------------------- cor / contraste

def parse_color(s):
    if not s:
        return None
    m = re.match(r'rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,/\s]+([\d.]+))?', s)
    if not m:
        return None
    r, g, b = (float(m.group(i)) for i in (1, 2, 3))
    a = float(m.group(4)) if m.group(4) is not None else 1.0
    return (r, g, b, a)


def composite(fg, bg):
    """Texto semitransparente sobre fundo: o contraste real e o da cor composta."""
    if fg[3] >= 0.999:
        return fg[:3]
    a = fg[3]
    return tuple(fg[i] * a + bg[i] * (1 - a) for i in range(3))


def luminance(rgb):
    def ch(v):
        v = v / 255.0
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = (ch(x) for x in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast_ratio(fg_s, bg_s):
    fg, bg = parse_color(fg_s), parse_color(bg_s)
    if not fg or not bg:
        return None
    if bg[3] < 0.999:
        bg = composite(bg, (255, 255, 255, 1))
    else:
        bg = bg[:3]
    fg = composite(fg, bg + (1,)) if fg[3] < 0.999 else fg[:3]
    l1, l2 = luminance(fg), luminance(bg)
    hi, lo = max(l1, l2), min(l1, l2)
    return round((hi + 0.05) / (lo + 0.05), 2)


def is_large_text(font_size, font_weight):
    try:
        w = int(font_weight)
    except (ValueError, TypeError):
        w = 700 if str(font_weight).lower() == 'bold' else 400
    return font_size >= 24 or (font_size >= 18.66 and w >= 700)


# ---------------------------------------------------------------- geometria

def gap(a, b):
    """Menor distancia entre duas caixas; 0 se encostam ou sobrepoem."""
    dx = max(a['x'] - (b['x'] + b['w']), b['x'] - (a['x'] + a['w']), 0)
    dy = max(a['y'] - (b['y'] + b['h']), b['y'] - (a['y'] + a['h']), 0)
    return (dx * dx + dy * dy) ** 0.5


def center(r):
    """Centro da caixa."""
    return (r['x'] + r['w'] / 2.0, r['y'] + r['h'] / 2.0)


def point_to_box(px, py, r):
    """Menor distancia de um ponto ate uma caixa; 0 se o ponto esta dentro."""
    dx = max(r['x'] - px, px - (r['x'] + r['w']), 0)
    dy = max(r['y'] - py, py - (r['y'] + r['h']), 0)
    return (dx * dx + dy * dy) ** 0.5


def spacing_exception_holds(target, others):
    """Excecao de espacamento do WCAG 2.5.8.

    Um alvo menor que 24px CONTINUA conforme se um circulo de 24px de diametro
    centrado nele nao intersecta outro alvo, nem o circulo de outro alvo
    subdimensionado. Ignorar a excecao transforma padrao conforme em violacao de
    severidade 3: num teste real foram 216 ocorrencias em links de rodape com
    36px de centro a centro, todos conformes.

    Um alvo de 20px ainda pode ser desconfortavel ao toque - mas isso e Fitts, na
    trilha de usabilidade, nao violacao normativa de acessibilidade. Manter a
    distincao e o que sustenta a credibilidade do relatorio.
    """
    cx, cy = center(target['rect'])
    for other in others:
        if other is target:
            continue
        r = other['rect']
        if min(r['w'], r['h']) <= 0:
            continue
        if min(r['w'], r['h']) < 24:
            ox, oy = center(r)
            if ((cx - ox) ** 2 + (cy - oy) ** 2) ** 0.5 < 24:
                return False
        elif point_to_box(cx, cy, r) < 12:
            return False
    return True


def has_skip_link(stops, inv):
    """WCAG 2.4.1 por estrutura, nao por texto.

    A deteccao anterior casava /pular|skip/ no nome acessivel e reprovava
    "Ir para o conteudo" - redacao pt-BR igualmente padrao -, produzindo um falso
    positivo por rota. O que caracteriza um skip link nao e a palavra: e estar
    entre as primeiras paradas de foco e apontar para uma ancora interna.
    """
    head = [s for s in stops[:3] if isinstance(s, dict)]
    for s in head:
        href = s.get('href')
        if isinstance(href, str) and href.startswith('#') and len(href) > 1:
            return True
    # Captura gravada antes de `href` entrar no probe de foco: usa o sinal
    # estrutural do inventario em vez de voltar a adivinhar pelo texto.
    if not any('href' in s for s in head):
        return bool((inv.get('landmarks') or {}).get('skip_link'))
    return False


def leaf(selector):
    """Ultimo segmento do seletor, com digitos normalizados: identifica a CLASSE do
    elemento, nao a instancia. E o que permite agrupar 145 links pequenos em
    'o componente link e pequeno'. Sem normalizar, ids gerados (#up_44123456)
    produzem um grupo por elemento e o relatorio volta a ser uma lista plana."""
    if not selector:
        return ''
    seg = selector.split(' > ')[-1].split(' | ')[0]
    return re.sub(r'\d+', '#', seg)


DESTRUCTIVE = re.compile(r'excluir|apagar|remover|deletar|cancelar|delete|remove|discard', re.I)

AUTOCOMPLETE_EXPECTED = {
    'email': 'email', 'tel': 'tel', 'password': 'current-password or new-password',
}
FIELD_HINTS = [
    (re.compile(r'e-?mail', re.I), 'email', 'email'),
    (re.compile(r'phone|telefone|celular|whats', re.I), 'tel', 'tel'),
    (re.compile(r'cep|zip|postal', re.I), 'numeric', 'postal-code'),
    (re.compile(r'cpf|cnpj|documento', re.I), 'numeric', None),
    (re.compile(r'card|cartao|numero.*cartao', re.I), 'numeric', 'cc-number'),
    (re.compile(r'nome|name', re.I), None, 'name'),
]


# ---------------------------------------------------------------- checagens

def run_checks(rec):
    """Retorna lista de ocorrencias para uma captura (rota x viewport)."""
    out = []
    inv = rec.get('inventory') or {}
    vp = rec.get('viewport', '?')
    route = rec.get('route', '?')
    width = int(vp.split('x')[0]) if 'x' in vp else 1440
    mobile = width < 768

    def add(check, severity_hint, track, message, selector=None, measured=None, ref=None,
            group=None):
        # `group` decide o que vira UM achado. Escolha a chave que corresponde a
        # UMA correcao: para contraste e o par de cores (um token), para alvo e o
        # componente. Agrupar por valor medido produziria um achado por pixel.
        out.append({
            'check': check, 'severity_hint': severity_hint, 'track': track,
            'route': route, 'viewport': vp, 'selector': selector,
            'message': message, 'measured': measured, 'ref': ref,
            'group': group or (check, selector or ''),
        })

    # --- contraste de texto (WCAG 1.4.3)
    for t in inv.get('text', []):
        if t.get('bg_unreliable') or t.get('over_image'):
            # Gradiente, imagem ou fundo indeterminado no caminho: nao existe numero
            # valido a reportar. Encaminhe para verificacao visual em vez de emitir
            # uma razao que parece precisa e esta errada.
            add('contrast_unverifiable', 1, 'accessibility',
                'Fundo com gradiente ou imagem: contraste nao e calculavel, verifique visualmente',
                t['selector'], {'sample': t['sample'], 'color': t['color']}, 'WCAG 1.4.3',
                group=('contrast_unverifiable', leaf(t['selector'])))
            continue
        cr = contrast_ratio(t['color'], t['bg'])
        if cr is None:
            continue
        need = 3.0 if is_large_text(t['font_size'], t['font_weight']) else 4.5
        if cr < need:
            add('contrast_text', 3 if cr < need * 0.75 else 2, 'accessibility',
                f'Texto {t["color"]} sobre {t["bg"]}: contraste {cr}:1, minimo {need}:1',
                t['selector'],
                {'ratio': cr, 'required': need, 'font_size': t['font_size'],
                 'color': t['color'], 'bg': t['bg'], 'sample': t['sample']},
                'WCAG 1.4.3',
                # o par de cores e a unidade de correcao: um token, nao 400 elementos
                group=('contrast_text', t['color'], t['bg']))

    # --- tamanho de alvo (WCAG 2.2 - 2.5.8) e conforto real
    targets = [e for e in inv.get('interactive', []) if not e.get('disabled')]
    for e in targets:
        r = e['rect']
        small = min(r['w'], r['h'])
        if small <= 0:
            continue
        if small < 24 and not spacing_exception_holds(e, targets):
            add('target_too_small', 3, 'accessibility',
                'Alvo interativo abaixo do minimo de 24px e sem o espacamento que o isentaria',
                e['selector'], {'w': r['w'], 'h': r['h'], 'min_side': small, 'name': e['name']},
                'WCAG 2.5.8', group=('target_too_small', leaf(e['selector'])))
        elif mobile and small < 44:
            add('target_below_comfort', 2, 'usability',
                'Alvo abaixo do conforto de toque (44px)',
                e['selector'], {'w': r['w'], 'h': r['h'], 'min_side': small, 'name': e['name']},
                'Lei de Fitts', group=('target_below_comfort', leaf(e['selector'])))

    # --- espacamento entre alvos; pior quando um deles e destrutivo
    for i, a in enumerate(targets):
        for b in targets[i + 1:]:
            if abs(a['rect']['y'] - b['rect']['y']) > 200:
                continue
            g = gap(a['rect'], b['rect'])
            if g < 8:
                destructive = bool(DESTRUCTIVE.search((a['name'] or '') + ' ' + (b['name'] or '')))
                add('targets_too_close', 3 if destructive else 2, 'usability',
                    'Alvos adjacentes sem espacamento suficiente'
                    + (', um deles destrutivo' if destructive else ''),
                    f'{a["selector"]} | {b["selector"]}',
                    {'gap': round(g), 'a': a['name'], 'b': b['name']}, 'Lei de Fitts',
                    group=('targets_too_close', leaf(a['selector']), leaf(b['selector']),
                           destructive))

    # --- clicavel sem ser focavel
    for e in inv.get('pseudo_interactive', []):
        add('clickable_not_focusable', 3, 'accessibility',
            'Elemento clicavel nao alcancavel por teclado: sem role, sem tabindex',
            e['selector'], {'tag': e['tag'], 'name': e['name']}, 'WCAG 2.1.1',
            group=('clickable_not_focusable', leaf(e['selector'])))

    # --- layout
    lay = inv.get('layout', {})
    if lay.get('horizontal_overflow'):
        add('horizontal_overflow', 3, 'usability',
            f'Rolagem horizontal: conteudo {lay["scroll_width"]}px em viewport de {lay["client_width"]}px',
            (lay.get('overflowing_elements') or [{}])[0].get('selector'),
            {'scroll_width': lay['scroll_width'], 'client_width': lay['client_width'],
             'culprits': [o['selector'] for o in lay.get('overflowing_elements', [])[:5]]})

    z = rec.get('zoom200')
    if z and z.get('sw', 0) > z.get('cw', 0) + 1:
        add('zoom200_reflow', 3, 'accessibility',
            'Layout quebra com zoom de 200%: surge rolagem horizontal',
            None, z, 'WCAG 1.4.4')

    vm = inv.get('viewport_meta') or ''
    if 'user-scalable=no' in vm.replace(' ', '') or re.search(r'maximum-scale=\s*1(\.0)?\b', vm):
        add('zoom_blocked', 3, 'accessibility',
            'Meta viewport bloqueia o zoom do usuario',
            'meta[name=viewport]', {'content': vm}, 'WCAG 1.4.4')

    if not inv.get('lang'):
        add('missing_lang', 2, 'accessibility',
            'Sem atributo lang no html: leitor de tela usa a pronuncia errada',
            'html', None, 'WCAG 3.1.1')

    if not inv.get('landmarks', {}).get('main'):
        add('missing_main', 1, 'accessibility',
            'Sem landmark main: navegacao por regiao fica indisponivel', None, None, 'WCAG 1.3.1')

    # --- formularios
    for f in inv.get('fields', []):
        if not f.get('label'):
            add('field_no_label', 3, 'accessibility',
                'Campo sem rotulo acessivel', f['selector'],
                {'type': f['type'], 'name': f['name_attr']}, 'WCAG 3.3.2')
        elif f.get('placeholder_only'):
            add('placeholder_as_label', 2, 'usability',
                'Placeholder usado como rotulo: some ao digitar e obriga a lembrar o que era',
                f['selector'], {'type': f['type']}, 'Reconhecimento vs. memorizacao')

        hay = ' '.join(filter(None, [f.get('name_attr'), f.get('label'), f['selector']]))
        for rx, want_inputmode, want_auto in FIELD_HINTS:
            if rx.search(hay):
                if mobile and want_inputmode and not f.get('inputmode') and f['type'] == 'text':
                    add('wrong_keyboard', 2, 'usability',
                        f'Campo provavelmente {want_inputmode} sem inputmode: teclado errado no mobile',
                        f['selector'], {'suggest_inputmode': want_inputmode}, 'Lei de Postel')
                if want_auto and not f.get('autocomplete'):
                    add('missing_autocomplete', 1, 'usability',
                        f'Sem autocomplete ({want_auto}): usuario redigita o que o navegador ja sabe',
                        f['selector'], {'suggest': want_auto}, 'WCAG 1.3.5')
                break
        if f.get('pattern') and f['type'] == 'text':
            add('strict_pattern', 1, 'usability',
                'Pattern restritivo: verifique se rejeita colagem e variacoes de formato',
                f['selector'], {'pattern': f['pattern']}, 'Lei de Postel')

    # --- imagens
    for im in inv.get('images', []):
        if not im.get('has_alt_attr'):
            add('img_no_alt', 2, 'accessibility',
                'Imagem sem atributo alt', im['selector'], {'src': im['src']}, 'WCAG 1.1.1')
        if not im.get('reserved'):
            add('img_no_dimensions', 1, 'perceived_performance',
                'Imagem sem dimensao reservada: desloca o layout ao carregar',
                im['selector'], {'src': im['src']}, 'CLS',
                group=('img_no_dimensions', leaf(im['selector'])))

    # --- headings
    # Sem guarda `if hs`: a pagina sem cabecalho NENHUM e o caso pior, e era
    # exatamente o que escapava quando o bloco inteiro vivia dentro da guarda -
    # a ferramenta pegava o h3 vazio e deixava passar a pagina vazia.
    hs = inv.get('headings', [])
    if not any(h['level'] == 1 for h in hs):
        add('no_h1', 2 if not hs else 1, 'accessibility',
            'Pagina sem nenhum cabecalho' if not hs else 'Pagina sem h1', None,
            {'first': hs[0]['text'] if hs else None, 'total_headings': len(hs)}, 'WCAG 1.3.1')
    prev = 0
    for h in hs:
        if prev and h['level'] > prev + 1:
            add('heading_skip', 1, 'accessibility',
                f'Salto de h{prev} para h{h["level"]}', None, {'text': h['text']}, 'WCAG 1.3.1')
        prev = h['level']

    # --- foco por teclado
    stops = rec.get('tab_order') or []
    invisible = [s for s in stops if isinstance(s, dict) and s.get('focus_visible') is False]
    if invisible:
        add('focus_not_visible', 3, 'accessibility',
            f'{len(invisible)} paradas de foco sem indicador visivel: quem navega por teclado se perde',
            invisible[0].get('id') or invisible[0].get('tag'),
            {'examples': [s.get('name') for s in invisible[:5]], 'total': len(invisible)},
            'WCAG 2.4.7')
    offscreen = [s for s in stops if isinstance(s, dict) and s.get('in_viewport') is False]
    if offscreen:
        add('focus_offscreen', 2, 'accessibility',
            f'{len(offscreen)} paradas de foco fora da area visivel sem rolar ate elas',
            None, {'examples': [s.get('name') for s in offscreen[:5]]}, 'WCAG 2.4.11')
    if any(isinstance(s, dict) and s.get('loop_detected') for s in stops):
        add('focus_trap', 4, 'accessibility',
            'Foco parece preso em um ciclo: possivel armadilha de teclado',
            None, None, 'WCAG 2.1.2')
    if stops and not has_skip_link(stops, inv):
        add('no_skip_link', 1, 'accessibility',
            'Sem link de pular para o conteudo entre as primeiras paradas de foco',
            None, None, 'WCAG 2.4.1')

    return out


# ---------------------------------------------------------------- agregacao

RANGE_KEYS = ('ratio', 'min_side', 'gap', 'w', 'h')


def consolidate(items):
    """Ocorrencias que se corrigem com UMA mudanca viram UM achado.

    Cinco links de 18px e 140 de 20px nao sao 145 achados: sao um componente
    pequeno demais, com 145 ocorrencias. Emitir uma linha por ocorrencia esconde
    a causa, infla o relatorio e treina a equipe a ignorar a auditoria."""
    groups = defaultdict(list)
    for it in items:
        groups[it['group']].append(it)

    findings = []
    for _, occ in groups.items():
        first = occ[0]
        ranges = {}
        for k in RANGE_KEYS:
            vals = [o['measured'][k] for o in occ
                    if isinstance(o.get('measured'), dict) and isinstance(o['measured'].get(k), (int, float))]
            if vals:
                ranges[k] = {'min': min(vals), 'max': max(vals)} if min(vals) != max(vals) else min(vals)

        findings.append({
            'check': first['check'],
            'track': first['track'],
            'severity_hint': max(o['severity_hint'] for o in occ),
            'ref': first['ref'],
            'message': first['message'],
            'systemic': len(occ) > 1,
            'occurrence_count': len(occ),
            'routes': sorted({o['route'] for o in occ}),
            'viewports': sorted({o['viewport'] for o in occ}),
            'selector': first['selector'],
            'measured_range': ranges or None,
            'occurrences': [
                {'route': o['route'], 'viewport': o['viewport'],
                 'selector': o['selector'], 'measured': o['measured']}
                for o in occ[:8]
            ],
            'occurrences_truncated': max(0, len(occ) - 8),
        })
    findings.sort(key=lambda f: (-f['severity_hint'], -f['occurrence_count'], f['check']))
    return rollup_tail(findings)


def rollup_tail(findings, keep_per_check=6):
    """Teto de legibilidade. Se um check ainda produz dezenas de grupos depois da
    normalizacao, mantem os maiores e junta a cauda num achado unico. Uma
    auditoria com 200 linhas nao e mais completa que uma com 30: e ilegivel, e
    ilegivel nao fecha decisao nenhuma."""
    by_check = defaultdict(list)
    for f in findings:
        by_check[f['check']].append(f)

    out, tails = [], []
    for check, group in by_check.items():
        out.extend(group[:keep_per_check])
        tail = group[keep_per_check:]
        if tail:
            first = tail[0]
            tails.append({
                'check': check, 'track': first['track'],
                'severity_hint': max(f['severity_hint'] for f in tail),
                'ref': first['ref'],
                'message': first['message'] + f' — cauda de {len(tail)} variantes do mesmo check',
                'systemic': True,
                'occurrence_count': sum(f['occurrence_count'] for f in tail),
                'routes': sorted({r for f in tail for r in f['routes']}),
                'viewports': sorted({v for f in tail for v in f['viewports']}),
                'selector': None,
                'measured_range': None,
                'rolled_up': True,
                'rolled_selectors': [f['selector'] for f in tail[:20] if f['selector']],
                'occurrences': [], 'occurrences_truncated': 0,
            })
    result = out + tails
    result.sort(key=lambda f: (-f['severity_hint'], -f['occurrence_count'], f['check']))
    return result


def main():
    ap = argparse.ArgumentParser(description="Defeitos mensuraveis a partir da captura")
    ap.add_argument('run_dir')
    ap.add_argument('--out', default=None)
    args = ap.parse_args()

    files = sorted(f for f in glob.glob(os.path.join(args.run_dir, '*.json'))
                   if os.path.basename(f) not in ('manifest.json', 'deterministic.json'))
    if not files:
        sys.exit(f"nenhuma captura em {args.run_dir}")

    raw = []
    for path in files:
        with open(path) as fh:
            rec = json.load(fh)
        if 'inventory' in rec:
            raw.append((rec, run_checks(rec)))

    all_items = [i for _, items in raw for i in items]
    findings = consolidate(all_items)

    by_track = defaultdict(int)
    for f in findings:
        by_track[f['track']] += 1

    result = {
        'run_dir': args.run_dir,
        'captures_analyzed': len(raw),
        'total_occurrences': len(all_items),
        'findings': findings,
        'summary': {
            'by_track': dict(by_track),
            'by_severity_hint': {str(s): sum(1 for f in findings if f['severity_hint'] == s)
                                 for s in (4, 3, 2, 1)},
            'systemic': sum(1 for f in findings if f['systemic']),
        },
        'note': ('Severidade aqui e um PISO tecnico. Recalcule com frequencia na jornada, '
                 'impacto, persistencia e peso do breakpoint antes de escrever o relatorio. '
                 'Estes checks cobrem so o mensuravel - a maior parte dos achados de UX exige '
                 'inspecao das jornadas, estados e microcopia.'),
    }

    out = args.out or os.path.join(args.run_dir, 'deterministic.json')
    with open(out, 'w') as fh:
        json.dump(result, fh, ensure_ascii=False, indent=1)

    print(f"{len(findings)} achados mensuraveis ({len(all_items)} ocorrencias) -> {out}")
    for f in findings[:20]:
        tag = f' x{f["occurrence_count"]}' if f['systemic'] else ''
        rng = ''
        if f.get('measured_range'):
            bits = [f'{k}={v["min"]}-{v["max"]}' if isinstance(v, dict) else f'{k}={v}'
                    for k, v in list(f['measured_range'].items())[:2]]
            rng = '  (' + ', '.join(bits) + ')'
        print(f"  [{f['severity_hint']}] {f['check']}{tag}: {f['message'][:70]}{rng}")


if __name__ == '__main__':
    main()
