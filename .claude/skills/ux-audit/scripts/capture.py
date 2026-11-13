#!/usr/bin/env python3
"""
Captura instrumentada para auditoria de UX de web responsiva.

Para cada rota x viewport grava: screenshot de pagina inteira, inventario de
elementos com caixas e estilos computados, ordem de foco por teclado, e sinais
de layout (overflow horizontal, meta viewport, zoom bloqueado).

O objetivo e produzir MEDIDAS, nao julgamento. Contraste e tamanho de alvo
estimados a olho erram muito e comprometem a credibilidade do relatorio inteiro;
aqui eles saem em numero.

Uso:
  python capture.py --url https://app.exemplo.com --out ./audit-run \
      --viewports 360x740,768x1024,1440x900 --routes /,/login,/checkout

  # login uma vez, reaproveitar sessao
  python capture.py --url https://app/login --login-user a@b.c --login-pass x \
      --save-storage auth.json --out ./tmp
  python capture.py --url https://app --storage-state auth.json --routes /app --out ./audit-run
"""

import argparse
import json
import os
import re
import sys
from urllib.parse import urljoin, urlparse

try:
    from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout
except ImportError:
    sys.exit("playwright nao instalado. Rode: pip install playwright && playwright install chromium")


# ---------------------------------------------------------------- instrumentacao

# Roda dentro da pagina. Coleta o que so existe apos o render: caixas reais,
# cores efetivas (resolvendo fundo transparente subindo a arvore) e relacoes
# de rotulo. Nada aqui julga - so mede.
INVENTORY_JS = r"""
() => {
  const px = v => parseFloat(v) || 0;

  // Fundo efetivo: um bg com alpha 0.08 nao e o fundo real - o que o olho ve e a
  // composicao dele sobre o que esta atras. Tratar a camada semitransparente como
  // opaca produz razao de contraste errada, que e pior que nao medir.
  const bgInfo = (el) => {
    const layers = [];
    let node = el, unreliable = false, opaque = false;
    while (node && node.nodeType === 1) {
      const cs = getComputedStyle(node);
      // gradiente ou imagem no caminho: a cor efetiva varia por pixel e nenhuma
      // razao calculada aqui e valida. Reportar como nao verificavel e honesto;
      // reportar um numero inventado destroi a credibilidade do relatorio inteiro.
      if (cs.backgroundImage && cs.backgroundImage !== 'none') unreliable = true;
      const m = cs.backgroundColor &&
        cs.backgroundColor.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,/\s]+([\d.]+))?/);
      if (m) {
        const a = m[4] === undefined ? 1 : parseFloat(m[4]);
        if (a > 0.001) {
          layers.push([+m[1], +m[2], +m[3], a]);
          if (a >= 0.999) { opaque = true; break; }
        }
      }
      node = node.parentElement;
    }
    // sem camada opaca ate a raiz, o branco assumido pode nao ser o fundo real
    if (!opaque && layers.length === 0) unreliable = true;
    layers.push([255, 255, 255, 1]);
    let [r, g, b] = layers[layers.length - 1];
    for (let i = layers.length - 2; i >= 0; i--) {
      const [lr, lg, lb, la] = layers[i];
      r = lr * la + r * (1 - la);
      g = lg * la + g * (1 - la);
      b = lb * la + b * (1 - la);
    }
    return { color: `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`, unreliable };
  };

  const effectiveBg = (el) => bgInfo(el).color;

  const accName = (el) => {
    const aria = el.getAttribute('aria-label');
    if (aria && aria.trim()) return aria.trim();
    const lb = el.getAttribute('aria-labelledby');
    if (lb) {
      const t = lb.split(/\s+/).map(id => (document.getElementById(id) || {}).innerText || '').join(' ').trim();
      if (t) return t;
    }
    if (el.id) {
      const lab = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (lab && lab.innerText.trim()) return lab.innerText.trim();
    }
    const wrap = el.closest('label');
    if (wrap && wrap.innerText.trim()) return wrap.innerText.trim();
    if (el.alt && el.alt.trim()) return el.alt.trim();
    if (el.title && el.title.trim()) return el.title.trim();
    const txt = (el.innerText || el.value || '').trim();
    return txt.slice(0, 120);
  };

  const selectorFor = (el) => {
    if (el.id) return `#${el.id}`;
    const parts = [];
    let node = el;
    for (let i = 0; node && node.nodeType === 1 && i < 4; i++) {
      let p = node.tagName.toLowerCase();
      const cls = (node.className && typeof node.className === 'string')
        ? node.className.trim().split(/\s+/).slice(0, 2).filter(Boolean) : [];
      if (cls.length) p += '.' + cls.join('.');
      parts.unshift(p);
      node = node.parentElement;
    }
    return parts.join(' > ');
  };

  const visible = (el, r) => {
    if (r.width <= 0 || r.height <= 0) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none' && px(cs.opacity) > 0.05;
  };

  // --- elementos interativos
  const INTERACTIVE = 'a[href], button, input, select, textarea, summary, ' +
    '[role=button], [role=link], [role=checkbox], [role=tab], [role=menuitem], ' +
    '[role=switch], [onclick], [tabindex]:not([tabindex="-1"])';

  const interactive = [];
  document.querySelectorAll(INTERACTIVE).forEach(el => {
    const r = el.getBoundingClientRect();
    if (!visible(el, r)) return;
    const cs = getComputedStyle(el);
    interactive.push({
      tag: el.tagName.toLowerCase(),
      type: el.getAttribute('type') || null,
      role: el.getAttribute('role') || null,
      name: accName(el),
      href: el.tagName === 'A' ? (el.getAttribute('href') || null) : null,
      selector: selectorFor(el),
      rect: { x: Math.round(r.x), y: Math.round(r.y + window.scrollY),
              w: Math.round(r.width), h: Math.round(r.height) },
      disabled: el.disabled === true || el.getAttribute('aria-disabled') === 'true',
      font_size: px(cs.fontSize),
      color: cs.color,
      bg: effectiveBg(el),
      cursor: cs.cursor,
      inputmode: el.getAttribute('inputmode') || null,
      autocomplete: el.getAttribute('autocomplete') || null,
      required: el.hasAttribute('required') || el.getAttribute('aria-required') === 'true',
      has_visible_label: !!(accName(el))
    });
  });

  // Elementos que parecem clicaveis (cursor pointer ou handler) mas nao sao
  // alcancaveis por teclado. Quem usa mouse nem percebe; quem navega por teclado
  // simplesmente nao consegue executar a acao.
  const pseudo_interactive = [];
  document.querySelectorAll('div, span, li, td, p, section, article, img, svg').forEach(el => {
    if (el.matches(INTERACTIVE) || el.closest(INTERACTIVE)) return;
    const cs = getComputedStyle(el);
    const clickable = cs.cursor === 'pointer' || el.hasAttribute('onclick');
    if (!clickable) return;
    const r = el.getBoundingClientRect();
    if (!visible(el, r)) return;
    const focusable = el.hasAttribute('tabindex') && el.getAttribute('tabindex') !== '-1';
    if (focusable) return;
    pseudo_interactive.push({
      tag: el.tagName.toLowerCase(),
      selector: selectorFor(el),
      name: accName(el).slice(0, 60),
      role: el.getAttribute('role') || null,
      rect: { x: Math.round(r.x), y: Math.round(r.y + window.scrollY),
              w: Math.round(r.width), h: Math.round(r.height) }
    });
    if (pseudo_interactive.length > 80) return;
  });

  // --- texto, para contraste
  const text = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  let n;
  while ((n = walker.nextNode())) {
    const s = n.nodeValue.trim();
    if (s.length < 3) continue;
    const el = n.parentElement;
    if (!el || seen.has(el)) continue;
    seen.add(el);
    const r = el.getBoundingClientRect();
    if (!visible(el, r)) continue;
    const cs = getComputedStyle(el);
    const bi = bgInfo(el);
    text.push({
      selector: selectorFor(el),
      sample: s.slice(0, 80),
      font_size: px(cs.fontSize),
      font_weight: cs.fontWeight,
      color: cs.color,
      bg: bi.color,
      bg_unreliable: bi.unreliable,
      rect: { x: Math.round(r.x), y: Math.round(r.y + window.scrollY),
              w: Math.round(r.width), h: Math.round(r.height) }
    });
    if (text.length > 600) break;
  }

  // --- formularios
  const fields = [];
  document.querySelectorAll('input, select, textarea').forEach(el => {
    const r = el.getBoundingClientRect();
    if (!visible(el, r)) return;
    const t = (el.getAttribute('type') || 'text').toLowerCase();
    if (['hidden', 'submit', 'button', 'reset', 'image'].includes(t)) return;
    fields.push({
      selector: selectorFor(el),
      type: t,
      name_attr: el.getAttribute('name') || null,
      label: accName(el),
      placeholder_only: !accName(el) && !!el.getAttribute('placeholder'),
      inputmode: el.getAttribute('inputmode') || null,
      autocomplete: el.getAttribute('autocomplete') || null,
      pattern: el.getAttribute('pattern') || null,
      maxlength: el.getAttribute('maxlength') || null,
      required: el.hasAttribute('required'),
      described_by: el.getAttribute('aria-describedby') || null,
      invalid: el.getAttribute('aria-invalid') || null
    });
  });

  // --- imagens
  const images = [];
  document.querySelectorAll('img').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width <= 1 || r.height <= 1) return;
    images.push({
      selector: selectorFor(el),
      src: (el.currentSrc || el.src || '').slice(-120),
      alt: el.getAttribute('alt'),
      has_alt_attr: el.hasAttribute('alt'),
      decorative: el.getAttribute('role') === 'presentation' || el.getAttribute('alt') === '',
      // dimensao reservada evita deslocamento de layout no carregamento
      reserved: !!(el.getAttribute('width') && el.getAttribute('height')) ||
                getComputedStyle(el).aspectRatio !== 'auto',
      loading: el.getAttribute('loading') || null
    });
  });

  // --- headings
  const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')]
    .map(el => ({ level: +el.tagName[1], text: el.innerText.trim().slice(0, 100) }));

  // --- layout
  const de = document.documentElement;
  const overflowing = [];
  if (de.scrollWidth > de.clientWidth + 1) {
    document.querySelectorAll('body *').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.right > de.clientWidth + 1 && r.width > 0) {
        overflowing.push({ selector: selectorFor(el), right: Math.round(r.right), width: Math.round(r.width) });
      }
    });
  }

  const vpMeta = document.querySelector('meta[name="viewport"]');

  // Rotas internas visiveis a partir desta pagina. E o que converte a pergunta
  // "quais sao as jornadas?" (aberta, convida a inventar) em "destas rotas, quais
  // sao criticas?" (fechada, ancorada no produto real).
  const routesSeen = new Map();
  document.querySelectorAll('a[href]').forEach(a => {
    let u; try { u = new URL(a.getAttribute('href'), location.href); } catch { return; }
    if (u.origin !== location.origin) return;
    const path = u.pathname.replace(/\/$/, '') || '/';
    if (path.match(/\.(png|jpg|svg|pdf|zip)$/i)) return;
    if (!routesSeen.has(path)) routesSeen.set(path, accName(a).slice(0, 40));
  });
  const internal_routes = [...routesSeen].slice(0, 60).map(([path, label]) => ({ path, label }));

  return {
    url: location.href,
    title: document.title,
    lang: de.getAttribute('lang'),
    viewport_meta: vpMeta ? vpMeta.getAttribute('content') : null,
    layout: {
      scroll_width: de.scrollWidth,
      client_width: de.clientWidth,
      scroll_height: de.scrollHeight,
      client_height: de.clientHeight,
      horizontal_overflow: de.scrollWidth > de.clientWidth + 1,
      overflowing_elements: overflowing.slice(0, 25)
    },
    landmarks: {
      main: !!document.querySelector('main, [role=main]'),
      nav: document.querySelectorAll('nav, [role=navigation]').length,
      skip_link: !!document.querySelector('a[href^="#"]:first-of-type')
    },
    internal_routes, interactive, pseudo_interactive, text, fields, images, headings
  };
}
"""

FOCUS_STYLE_JS = r"""
() => {
  const el = document.activeElement;
  if (!el || el === document.body) return null;
  const cs = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  return {
    tag: el.tagName.toLowerCase(),
    name: (el.getAttribute('aria-label') || el.innerText || el.value || '').trim().slice(0, 80),
    // O destino importa para o skip link: o que o caracteriza e apontar para uma
    // ancora interna a partir das primeiras paradas, nao conter a palavra "pular".
    href: el.getAttribute('href') || null,
    id: el.id || null,
    rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
    in_viewport: r.top >= -1 && r.bottom <= window.innerHeight + 1,
    outline_style: cs.outlineStyle,
    outline_width: cs.outlineWidth,
    outline_color: cs.outlineColor,
    box_shadow: cs.boxShadow,
    // sem outline nem sombra o foco e invisivel: quem navega por teclado se perde
    focus_visible: (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) ||
                   (cs.boxShadow && cs.boxShadow !== 'none')
  };
}
"""


# ---------------------------------------------------------------- helpers

def parse_viewports(s):
    out = []
    for part in s.split(','):
        part = part.strip()
        m = re.match(r'^(\d+)x(\d+)$', part)
        if not m:
            sys.exit(f"viewport invalido: {part!r} (use 360x740)")
        out.append((int(m.group(1)), int(m.group(2))))
    return out


def slug(s):
    s = re.sub(r'^https?://', '', s)
    s = re.sub(r'[^a-zA-Z0-9]+', '-', s).strip('-')
    return s[:60] or 'root'


def do_login(page, args):
    page.goto(args.login_url or args.url, wait_until='domcontentloaded')
    page.wait_for_timeout(1000)
    user_sel = args.login_user_selector or 'input[type=email], input[name*=email i], input[name*=user i]'
    pass_sel = args.login_pass_selector or 'input[type=password]'
    page.locator(user_sel).first.fill(args.login_user)
    page.locator(pass_sel).first.fill(args.login_pass)
    try:
        page.locator('button[type=submit], input[type=submit], button:has-text("Entrar"), '
                     'button:has-text("Login"), button:has-text("Sign in")').first.click()
    except Exception:
        page.keyboard.press('Enter')
    page.wait_for_load_state('networkidle', timeout=20000)


def tab_walk(page, limit=60):
    """Percorre a ordem de foco. Encontra em segundos o que a inspecao visual
    nao ve: foco invisivel, ordem divergente da visual, armadilha em modal."""
    stops, seen_ids = [], set()
    prev_behavior = None
    try:
        # A rolagem que o navegador faz ao focar e animada quando a pagina declara
        # `scroll-behavior: smooth`, e o rect lido logo apos o Tab e o de ANTES da
        # animacao - o que marcava como fora da vista elementos que o navegador de
        # fato traz a vista. Medir exige rolagem instantanea, entao desligamos a
        # animacao durante o percurso e devolvemos o valor original no fim.
        prev_behavior = page.evaluate("""() => {
          const de = document.documentElement;
          const prev = de.style.scrollBehavior;
          de.style.scrollBehavior = 'auto';
          return prev;
        }""")
        page.evaluate("() => (document.activeElement||document.body).blur()")
        for i in range(limit):
            page.keyboard.press('Tab')
            info = page.evaluate(FOCUS_STYLE_JS)
            if info is None:
                break
            key = (info['tag'], info['name'], info['rect']['x'], info['rect']['y'])
            if key in seen_ids and i > 3:
                info['loop_detected'] = True
                stops.append(info)
                break
            seen_ids.add(key)
            info['order'] = i + 1
            stops.append(info)
    except Exception as e:
        stops.append({'error': str(e)})
    finally:
        if prev_behavior is not None:
            page.evaluate("(v) => { document.documentElement.style.scrollBehavior = v; }",
                          prev_behavior)
    return stops


# ---------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser(description="Captura instrumentada para auditoria de UX")
    ap.add_argument('--url', required=True, help='URL base (preview, staging, localhost)')
    ap.add_argument('--out', required=True, help='diretorio de saida')
    ap.add_argument('--viewports', default='360x740,768x1024,1440x900')
    ap.add_argument('--routes', default='/', help='caminhos separados por virgula')
    ap.add_argument('--wait-selector', default=None, help='espera esse seletor antes de capturar')
    ap.add_argument('--wait-ms', type=int, default=1500)
    ap.add_argument('--storage-state', default=None, help='reusa sessao salva (json)')
    ap.add_argument('--save-storage', default=None, help='salva sessao apos login')
    ap.add_argument('--login-url', default=None)
    ap.add_argument('--login-user', default=None)
    ap.add_argument('--login-pass', default=None)
    ap.add_argument('--login-user-selector', default=None)
    ap.add_argument('--login-pass-selector', default=None)
    ap.add_argument('--throttle', choices=['none', 'slow3g', 'fast3g'], default='none')
    ap.add_argument('--headed', action='store_true')
    ap.add_argument('--no-tab-walk', action='store_true')
    ap.add_argument('--timeout', type=int, default=30000)
    args = ap.parse_args()

    viewports = parse_viewports(args.viewports)
    routes = [r.strip() for r in args.routes.split(',') if r.strip()]
    os.makedirs(args.out, exist_ok=True)
    shots = os.path.join(args.out, 'screenshots')
    os.makedirs(shots, exist_ok=True)

    manifest = {'base_url': args.url, 'viewports': [f'{w}x{h}' for w, h in viewports],
                'routes': routes, 'captures': [], 'errors': []}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=not args.headed)

        if args.login_user and args.login_pass:
            ctx = browser.new_context(viewport={'width': 1440, 'height': 900})
            page = ctx.new_page()
            try:
                do_login(page, args)
                if args.save_storage:
                    ctx.storage_state(path=args.save_storage)
                    print(f"sessao salva em {args.save_storage}")
                if not args.storage_state:
                    args.storage_state = args.save_storage
            except Exception as e:
                manifest['errors'].append(f'login falhou: {e}')
                print(f"AVISO: login falhou: {e}", file=sys.stderr)
            ctx.close()

        for (w, h) in viewports:
            ctx_kwargs = {
                'viewport': {'width': w, 'height': h},
                'device_scale_factor': 2 if w < 500 else 1,
                'is_mobile': w < 500,
                'has_touch': w < 768,
                'user_agent': ('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 '
                               '(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1') if w < 500 else None,
            }
            ctx_kwargs = {k: v for k, v in ctx_kwargs.items() if v is not None}
            if args.storage_state and os.path.exists(args.storage_state):
                ctx_kwargs['storage_state'] = args.storage_state
            ctx = browser.new_context(**ctx_kwargs)
            ctx.set_default_timeout(args.timeout)
            page = ctx.new_page()

            if args.throttle != 'none':
                cdp = ctx.new_cdp_session(page)
                profiles = {'slow3g': (400, 400_000, 400_000), 'fast3g': (150, 1_600_000, 750_000)}
                lat, down, up = profiles[args.throttle]
                cdp.send('Network.enable')
                cdp.send('Network.emulateNetworkConditions', {
                    'offline': False, 'latency': lat,
                    'downloadThroughput': down // 8, 'uploadThroughput': up // 8})

            for route in routes:
                target = urljoin(args.url, route) if not route.startswith('http') else route
                key = f"{slug(route)}__{w}x{h}"
                rec = {'route': route, 'url': target, 'viewport': f'{w}x{h}'}
                try:
                    page.goto(target, wait_until='domcontentloaded')
                    if args.wait_selector:
                        page.wait_for_selector(args.wait_selector, timeout=args.timeout)
                    try:
                        page.wait_for_load_state('networkidle', timeout=8000)
                    except PWTimeout:
                        pass
                    page.wait_for_timeout(args.wait_ms)

                    shot = os.path.join(shots, f'{key}.png')
                    page.screenshot(path=shot, full_page=True)
                    rec['screenshot'] = os.path.relpath(shot, args.out)

                    data = page.evaluate(INVENTORY_JS)
                    rec['inventory'] = data

                    # zoom 200% e obrigatorio (WCAG 1.4.4); reflow quebrado aparece como overflow
                    try:
                        ctx_zoom_w = max(320, w // 2)
                        page.set_viewport_size({'width': ctx_zoom_w, 'height': h})
                        page.wait_for_timeout(400)
                        rec['zoom200'] = page.evaluate(
                            "() => ({sw: document.documentElement.scrollWidth, "
                            "cw: document.documentElement.clientWidth})")
                        page.set_viewport_size({'width': w, 'height': h})
                        page.wait_for_timeout(300)
                    except Exception:
                        rec['zoom200'] = None

                    if not args.no_tab_walk:
                        rec['tab_order'] = tab_walk(page)

                    with open(os.path.join(args.out, f'{key}.json'), 'w') as f:
                        json.dump(rec, f, ensure_ascii=False, indent=1)
                    rec_ref = {k: rec[k] for k in ('route', 'url', 'viewport', 'screenshot') if k in rec}
                    rec_ref['data'] = f'{key}.json'
                    manifest['captures'].append(rec_ref)
                    print(f"ok  {route} @ {w}x{h}  "
                          f"({len(data['interactive'])} interativos, "
                          f"{'OVERFLOW' if data['layout']['horizontal_overflow'] else 'sem overflow'})")
                    if route == routes[0] and (w, h) == viewports[0]:
                        print(f"     titulo: {data['title'][:70]}")
                        for rt in data['internal_routes'][:15]:
                            print(f"     rota: {rt['path']:<30} {rt['label']}")
                except Exception as e:
                    manifest['errors'].append(f'{route}@{w}x{h}: {e}')
                    print(f"ERRO {route} @ {w}x{h}: {e}", file=sys.stderr)

            ctx.close()
        browser.close()

    with open(os.path.join(args.out, 'manifest.json'), 'w') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)
    print(f"\n{len(manifest['captures'])} capturas em {args.out}/")
    if manifest['errors']:
        print(f"{len(manifest['errors'])} erros - ver manifest.json")


if __name__ == '__main__':
    main()
