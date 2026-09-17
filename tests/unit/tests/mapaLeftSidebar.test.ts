import {
  buildLeftSidebar,
  modeTakesOpacity,
  modeUsesHexbinOpacity,
} from 'src/app/(features)/mapas/mapaLeftSidebar';

const settingsSection = (mode: Parameters<typeof buildLeftSidebar>[0]) => {
  return buildLeftSidebar(mode).sections.find((section) => {
    return section.id === 'Configurações';
  });
};

const blockIds = (mode: Parameters<typeof buildLeftSidebar>[0]) => {
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

describe('modeUsesHexbinOpacity', () => {
  test('is the grid alone', () => {
    expect(modeUsesHexbinOpacity('cafs-hexbin')).toBe(true);
    expect(modeUsesHexbinOpacity('coropletico')).toBe(false);
  });
});

describe('buildLeftSidebar', () => {
  /*
   * `enabledWhen` gates whole sections, not blocks, so the mesh block is
   * omitted per mode instead — which is why this config is built per mode
   * rather than declared once.
   */
  test('offers the mesh only where there is a mesh', () => {
    expect(blockIds('cafs-hexbin')).toEqual(['malha', 'opacidade']);
    expect(blockIds('coropletico')).toEqual(['opacidade']);
    expect(blockIds('pontos')).toEqual(['opacidade']);
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
