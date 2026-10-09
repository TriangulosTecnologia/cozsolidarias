import type { MapMode } from 'src/app/(features)/mapas/geovisSpec';
import {
  buildLeftSidebar,
  MAP_MODE_VALUES,
  modeTakes3d,
  modeTakesColorRamp,
  modeTakesOpacity,
  modeUsesHexbinOpacity,
  view3dFromSelection,
} from 'src/app/(features)/mapas/mapaLeftSidebar';

const settingsSection = (mode: MapMode) => {
  return buildLeftSidebar({ mode }).sections.find((section) => {
    return section.id === 'Configurações';
  });
};

const blockIds = (mode: MapMode) => {
  const body = settingsSection(mode)?.body;
  return body?.kind === 'settings'
    ? body.blocks.map((block) => {
        return block.id;
      })
    : [];
};

describe('modeTakesOpacity', () => {
  test('covers every choropleth, the grid, and the two kitchen views', () => {
    expect(modeTakesOpacity('coropletico')).toBe(true);
    expect(modeTakesOpacity('coropletico-ivs')).toBe(true);
    expect(modeTakesOpacity('cafs-hexbin')).toBe(true);
    expect(modeTakesOpacity('pontos')).toBe(true);
    expect(modeTakesOpacity('circulos')).toBe(true);
  });

  /*
   * `assentamentos` swaps the município fill for the estados one and colours it
   * categorically; `cafs` reads a tile pyramid the fill has no part in. In both
   * the slider would be moving a layer nobody is looking at.
   */
  test('leaves out the modes the slider would not be controlling', () => {
    expect(modeTakesOpacity('assentamentos')).toBe(false);
    expect(modeTakesOpacity('cafs')).toBe(false);
  });
});

describe('modeTakesColorRamp', () => {
  test('covers every choropleth, including the IVS and IDHM families', () => {
    expect(modeTakesColorRamp('coropletico')).toBe(true);
    expect(modeTakesColorRamp('coropletico-cadunico')).toBe(true);
    expect(modeTakesColorRamp('coropletico-ivs')).toBe(true);
    expect(modeTakesColorRamp('coropletico-idhm-renda')).toBe(true);
    expect(modeTakesColorRamp('cafs-hexbin')).toBe(true);
  });

  /*
   * The kitchen points and their circles read by position and size over a flat
   * backdrop, the settlements colour categorically, and the CAF hierarchy is a
   * tiled pyramid. None of them has a ladder of colours to redraw.
   */
  test('leaves out the modes with no ladder to redraw', () => {
    expect(modeTakesColorRamp('pontos')).toBe(false);
    expect(modeTakesColorRamp('circulos')).toBe(false);
    expect(modeTakesColorRamp('assentamentos')).toBe(false);
    expect(modeTakesColorRamp('cafs')).toBe(false);
  });
});

describe('modeUsesHexbinOpacity', () => {
  test('is the grid alone', () => {
    expect(modeUsesHexbinOpacity('cafs-hexbin')).toBe(true);
    expect(modeUsesHexbinOpacity('coropletico')).toBe(false);
  });
});

describe('modeTakes3d', () => {
  test('is the grid alone', () => {
    expect(modeTakes3d('cafs-hexbin')).toBe(true);
    expect(modeTakes3d('coropletico')).toBe(false);
    expect(modeTakes3d('cafs')).toBe(false);
  });
});

describe('view3dFromSelection', () => {
  test('is flat until the reader picks 3D', () => {
    expect(
      view3dFromSelection({ selection: {}, mode: 'cafs-hexbin' })
    ).toBeUndefined();
    expect(
      view3dFromSelection({ selection: { vista: '2d' }, mode: 'cafs-hexbin' })
    ).toBeUndefined();
  });

  /*
   * The 3D choice stays in the selection when the reader moves on, so switching
   * back to the grid finds it; the other modes must not read it.
   */
  test('ignores a 3D left on in a mode that cannot extrude', () => {
    expect(
      view3dFromSelection({ selection: { vista: '3d' }, mode: 'coropletico' })
    ).toBeUndefined();
  });

  test('opens on the controls own defaults', () => {
    expect(
      view3dFromSelection({ selection: { vista: '3d' }, mode: 'cafs-hexbin' })
    ).toEqual({ extrusionHeight: 60_000, pitch: 45 });
  });

  test('scales the height by the step and tilts by the choice', () => {
    expect(
      view3dFromSelection({
        selection: { vista: '3d', altura: '5', inclinacao: '60' },
        mode: 'cafs-hexbin',
      })
    ).toEqual({ extrusionHeight: 100_000, pitch: 60 });
  });
});

describe('buildLeftSidebar', () => {
  /*
   * `enabledWhen` gates whole sections, not blocks, so the mesh block is
   * omitted per mode instead — which is why this config is built per mode
   * rather than declared once.
   */
  test('offers the mesh only where there is a mesh', () => {
    expect(blockIds('cafs-hexbin')).toEqual([
      'vista',
      'altura',
      'inclinacao',
      'malha',
      'opacidade',
      'cores',
    ]);
    expect(blockIds('coropletico')).toEqual(['opacidade', 'cores']);
    expect(blockIds('pontos')).toEqual(['opacidade']);
  });

  test('offers the 3D view only where the map can extrude', () => {
    expect(blockIds('coropletico')).not.toContain('vista');
    expect(blockIds('pontos')).not.toContain('vista');
  });

  /*
   * The height and the tilt move nothing on a flat map, so they hide until the
   * reader picks 3D.
   */
  test('shows the 3D adjustments only while the map is extruded', () => {
    const body = settingsSection('cafs-hexbin')?.body;
    const blocks = body?.kind === 'settings' ? body.blocks : [];
    const shownWhen = (id: string) => {
      return blocks.find((block) => {
        return block.id === id;
      })?.shownWhen;
    };

    expect(shownWhen('vista')).toBeUndefined();
    expect(shownWhen('altura')).toEqual({ menuId: 'vista', values: ['3d'] });
    expect(shownWhen('inclinacao')).toEqual({
      menuId: 'vista',
      values: ['3d'],
    });
  });

  test('tags the grid variation as the one with a 3D view', () => {
    const body = buildLeftSidebar({ mode: 'cafs-hexbin' }).sections[0].body;
    const variations =
      body.kind === 'variations'
        ? body.groups.flatMap((group) => {
            return group.variations;
          })
        : [];

    const tagged = variations.filter((variation) => {
      return variation.badge === '3D';
    });

    expect(
      tagged.map((variation) => {
        return variation.value;
      })
    ).toEqual(['cafs-hexbin']);
  });

  test('offers the ramp only where the fill is a ladder of colours', () => {
    expect(blockIds('coropletico-ivs')).toEqual(['opacidade', 'cores']);
    expect(blockIds('coropletico-idhm')).toEqual(['opacidade', 'cores']);
    expect(blockIds('circulos')).toEqual(['opacidade']);
    expect(blockIds('circulos-pessoas')).toEqual(['opacidade']);
    expect(blockIds('pontos')).not.toContain('cores');
  });

  test('gates the tab on the modes that take opacity', () => {
    const gate = settingsSection('coropletico')?.enabledWhen;

    expect(gate?.menuId).toBe('visualizacao');
    expect(gate?.values).toContain('coropletico');
    expect(gate?.values).toContain('cafs-hexbin');
    expect(gate?.values).not.toContain('assentamentos');
  });

  /*
   * Only read at mount: the choropleth fill is opaque, while the grid opens at
   * 85 so the basemap's coastline stays legible under the palest cells.
   */
  test('opens the two subjects at their own opacity', () => {
    const opacityOf = (mode: Parameters<typeof buildLeftSidebar>[0]) => {
      const body = settingsSection(mode)?.body;
      if (body?.kind !== 'settings') return undefined;
      const block = body.blocks.find((entry) => {
        return entry.id === 'opacidade';
      });
      return block?.control.kind === 'slider'
        ? block.control.defaultValue
        : undefined;
    };

    expect(opacityOf('coropletico')).toBe(100);
    expect(opacityOf('cafs-hexbin')).toBe(85);
  });

  test('names the ends of the opacity scale', () => {
    const body = settingsSection('coropletico')?.body;
    const block =
      body?.kind === 'settings'
        ? body.blocks.find((entry) => {
            return entry.id === 'opacidade';
          })
        : undefined;

    expect(
      block?.control.kind === 'slider' ? block.control.endLabels : undefined
    ).toEqual(['Transparente', 'Opaca']);
  });
});

describe('MAP_MODE_VALUES', () => {
  /*
   * The list a shared link is validated against. Derived from the menu rather
   * than written beside it, so a variation renamed in one place cannot go on
   * being linkable from the other.
   */
  test('is every variation the menu offers, and nothing else', () => {
    expect(MAP_MODE_VALUES).toContain('coropletico');
    expect(MAP_MODE_VALUES).toContain('cafs-hexbin');
    expect(MAP_MODE_VALUES).toContain('circulos-pessoas');
    expect(MAP_MODE_VALUES).toContain('coropletico-idhm-educacao-frequencia');
    expect(new Set(MAP_MODE_VALUES).size).toBe(MAP_MODE_VALUES.length);
  });
});

describe('the colour block offer to build a ramp', () => {
  const colourControl = (
    ramps?: Parameters<typeof buildLeftSidebar>[0]['ramps']
  ) => {
    const body = buildLeftSidebar({ mode: 'coropletico', ramps }).sections.find(
      (section) => {
        return section.id === 'Configurações';
      }
    )?.body;

    if (body?.kind !== 'settings') return undefined;

    const block = body.blocks.find((candidate) => {
      return candidate.id === 'cores';
    });

    return block?.control.kind === 'colorRamp' ? block.control : undefined;
  };

  /*
   * Offered only when the page hands in the handlers: an affordance with
   * nowhere to report would mint a ramp that vanishes on the next render.
   */
  test('is absent when the page passes no handlers', () => {
    const control = colourControl();

    expect(control?.options.length).toBeGreaterThan(0);
    expect(control?.create).toBeUndefined();
    expect(control?.onRemove).toBeUndefined();
  });

  test('carries the handlers and the map own base colours', () => {
    const handlers = { onCreate: jest.fn(), onRemove: jest.fn() };
    const control = colourControl(handlers);

    expect(control?.create?.onCreate).toBe(handlers.onCreate);
    expect(control?.onRemove).toBe(handlers.onRemove);
    expect(control?.create?.baseColors.length).toBeGreaterThan(0);
    expect(control?.create?.baseColors[0]).toEqual(
      expect.objectContaining({
        color: expect.stringMatching(/^#[0-9A-Fa-f]{6}$/),
      })
    );
  });
});
