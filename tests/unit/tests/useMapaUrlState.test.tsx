import { act, renderHook } from '@testing-library/react';
import { DEFAULT_MODE } from 'src/app/(features)/mapas/mapaLeftSidebar';
import {
  selecaoFromSearch,
  useMapaUrlState,
  variacaoFromSearch,
} from 'src/app/(features)/mapas/useMapaUrlState';

/** Puts the browser on a URL, the way a shared link would have. */
const openAt = (search: string) => {
  window.history.replaceState(null, '', `/mapas${search}`);
};

/** The defaults a choropleth opens on, which the address is written against. */
const CHOROPLETH_DEFAULTS = {
  visualizacao: 'coropletico',
  opacidade: '100',
  cores: 'azul',
};

const query = () => {
  return new URLSearchParams(window.location.search);
};

beforeEach(() => {
  openAt('');
});

describe('selecaoFromSearch', () => {
  test('reads the three settings a link can name', () => {
    expect(
      selecaoFromSearch('?variacao=coropletico-ivs&opacidade=60&cores=vermelho')
    ).toEqual({
      visualizacao: 'coropletico-ivs',
      opacidade: '60',
      cores: 'vermelho',
    });
  });

  test('says nothing about what a link does not name', () => {
    expect(selecaoFromSearch('')).toEqual({});
    expect(selecaoFromSearch('?utm_source=whatsapp')).toEqual({});
  });

  /*
   * A link written by hand, or one saved before a variation was renamed. The
   * reader who followed it has no way to fix it, so the setting is dropped and
   * the map opens on its default.
   */
  test('drops a variation this map does not draw', () => {
    expect(selecaoFromSearch('?variacao=inventada')).toEqual({});
    expect(variacaoFromSearch('?variacao=inventada')).toBe(DEFAULT_MODE);
  });

  test('drops an opacity the slider could not have produced', () => {
    expect(selecaoFromSearch('?opacidade=29')).toEqual({});
    expect(selecaoFromSearch('?opacidade=101')).toEqual({});
    expect(selecaoFromSearch('?opacidade=60,5')).toEqual({});
    expect(selecaoFromSearch('?opacidade=muita')).toEqual({});
    expect(selecaoFromSearch('?opacidade=30')).toEqual({ opacidade: '30' });
  });

  test('drops a ramp that is not offered', () => {
    expect(selecaoFromSearch('?cores=roxo')).toEqual({});
    expect(selecaoFromSearch('?cores=laranja')).toEqual({ cores: 'laranja' });
  });
});

describe('useMapaUrlState', () => {
  test('opens on what the address asked for', () => {
    openAt('?variacao=coropletico-idhm&cores=verde');

    const { result } = renderHook(() => {
      return useMapaUrlState();
    });

    expect(result.current.selecaoInicial).toEqual({
      visualizacao: 'coropletico-idhm',
      cores: 'verde',
    });
  });

  test('writes what the reader changed', () => {
    const { result } = renderHook(() => {
      return useMapaUrlState();
    });

    act(() => {
      result.current.publicarSelecao({
        selection: {
          visualizacao: 'coropletico-taxa',
          opacidade: '60',
          cores: 'vermelho',
        },
        mode: 'coropletico-taxa',
        defaults: CHOROPLETH_DEFAULTS,
      });
    });

    expect(query().get('variacao')).toBe('coropletico-taxa');
    expect(query().get('opacidade')).toBe('60');
    expect(query().get('cores')).toBe('vermelho');
  });

  /*
   * A setting left where the variation opens it is not worth saying: the link
   * is shorter, and what it does name is what the sender changed.
   */
  test('leaves out a setting still on its default', () => {
    const { result } = renderHook(() => {
      return useMapaUrlState();
    });

    act(() => {
      result.current.publicarSelecao({
        selection: { ...CHOROPLETH_DEFAULTS, cores: 'verde' },
        mode: 'coropletico',
        defaults: CHOROPLETH_DEFAULTS,
      });
    });

    expect(query().get('opacidade')).toBeNull();
    expect(query().get('cores')).toBe('verde');
  });

  /*
   * The variation is what the link is about: a bare `/mapas` reads as someone
   * having forgotten to copy the rest of it.
   */
  test('always names the variation, default or not', () => {
    const { result } = renderHook(() => {
      return useMapaUrlState();
    });

    act(() => {
      result.current.publicarSelecao({
        selection: CHOROPLETH_DEFAULTS,
        mode: 'coropletico',
        defaults: CHOROPLETH_DEFAULTS,
      });
    });

    expect(query().get('variacao')).toBe('coropletico');
  });

  /*
   * The value is kept in the selection so switching back finds it, but a mode
   * with no such control has nothing to say about it in a link.
   */
  test('leaves out a setting the variation does not offer', () => {
    const { result } = renderHook(() => {
      return useMapaUrlState();
    });

    act(() => {
      result.current.publicarSelecao({
        selection: {
          visualizacao: 'pontos',
          opacidade: '60',
          cores: 'vermelho',
        },
        mode: 'pontos',
        defaults: { ...CHOROPLETH_DEFAULTS, visualizacao: 'pontos' },
      });
    });

    expect(query().get('opacidade')).toBe('60');
    expect(query().get('cores')).toBeNull();
  });

  /*
   * Replaced, not pushed: a reader comparing variations would otherwise have to
   * press back once per variation they tried before they could leave the page.
   */
  test('replaces the entry instead of stacking one per pick', () => {
    const { result } = renderHook(() => {
      return useMapaUrlState();
    });
    const before = window.history.length;

    act(() => {
      result.current.publicarSelecao({
        selection: { visualizacao: 'coropletico-taxa' },
        mode: 'coropletico-taxa',
        defaults: CHOROPLETH_DEFAULTS,
      });
      result.current.publicarSelecao({
        selection: { visualizacao: 'coropletico-percentual' },
        mode: 'coropletico-percentual',
        defaults: CHOROPLETH_DEFAULTS,
      });
    });

    expect(window.history.length).toBe(before);
    expect(query().get('variacao')).toBe('coropletico-percentual');
  });

  /*
   * The map republishes on every pick, including the ones that land on what the
   * address already says — a mode reselected, a slider dragged back. Writing
   * the same URL again is work the browser does not need.
   */
  test('says nothing when the address already reads that way', () => {
    const { result } = renderHook(() => {
      return useMapaUrlState();
    });
    const publish = () => {
      result.current.publicarSelecao({
        selection: { visualizacao: 'coropletico-ivs' },
        mode: 'coropletico-ivs',
        defaults: CHOROPLETH_DEFAULTS,
      });
    };

    act(publish);

    const replaceState = jest.spyOn(window.history, 'replaceState');
    act(publish);

    expect(replaceState).not.toHaveBeenCalled();
    expect(query().get('variacao')).toBe('coropletico-ivs');

    replaceState.mockRestore();
  });

  /*
   * The address is not this map's alone: whatever else a link carries has to
   * survive a variation being picked.
   */
  test('keeps the rest of the query string', () => {
    openAt('?utm_source=whatsapp');

    const { result } = renderHook(() => {
      return useMapaUrlState();
    });

    act(() => {
      result.current.publicarSelecao({
        selection: { visualizacao: 'coropletico-ivs' },
        mode: 'coropletico-ivs',
        defaults: CHOROPLETH_DEFAULTS,
      });
    });

    expect(query().get('utm_source')).toBe('whatsapp');
  });

  /*
   * Read once. Re-reading would fight every replacement the hook itself makes,
   * and the address is this map's to write once it is open.
   */
  test('does not re-read the address after the first render', () => {
    const { result, rerender } = renderHook(() => {
      return useMapaUrlState();
    });

    openAt('?variacao=coropletico-idhm');
    rerender();

    expect(result.current.selecaoInicial).toEqual({});
  });
});
