import { Box, Button, Stack, Text } from '@chakra-ui/react';
import type * as React from 'react';

import type {
  CadinsanByCity,
  KitchenEnabledShare2025,
} from '@/data-gateway/schema';

import type { EnabledShareContext } from './enabledShareContext';
import MunicipalCoverageMatrix from './MunicipalCoverageMatrix';
import {
  COVERAGE_TITLE,
  coverageByQuintile,
  coverageRiskCuts,
} from './municipalKitchenCoverage';

type State = NonNullable<React.ContextType<typeof EnabledShareContext>>;
const EMPTY_RISKS: CadinsanByCity[] = [];
const CircleKey = () => {
  return (
    <Stack gap="2">
      <Text fontSize="xs">
        Área do círculo = total cadastrado no município. Setor azul =
        habilitadas; cinza = demais situações. Tm = habilitadas ÷ cadastradas.
      </Text>
      <Box display="flex" gap="4">
        {[0, 25, 50, 100].map((percent) => {
          return (
            <Box key={percent} textAlign="center">
              <Box
                width="32px"
                height="32px"
                borderRadius="full"
                borderWidth="1px"
                borderColor="white"
                background={`conic-gradient(#0072B2 ${percent}%, #B8BDC5 0)`}
              />
              <Text fontSize="xs">{percent}%</Text>
            </Box>
          );
        })}
      </Box>
      <Text fontSize="xs">
        Sem círculo: sem cozinha no cadastro analisado. Contorno tracejado:
        menos de 5 cadastradas. Sem CADINSAN: não entra na tabela.
      </Text>
    </Stack>
  );
};
const CoverageTable = ({
  snapshot,
  risks,
  scenario,
}: {
  snapshot: KitchenEnabledShare2025 | null;
  risks: CadinsanByCity[];
  scenario: 'com' | 'sem';
}) => {
  if (!snapshot) return null;
  const groups = coverageByQuintile(
    snapshot.municipalCoverage,
    risks,
    scenario
  );
  return (
    <Stack gap="2">
      <Text fontSize="xs" fontWeight="bold">
        Tm por quintil conjunto · cenário {scenario} PBF
      </Text>
      <Box asChild fontSize="xs">
        <table>
          <thead>
            <tr>
              <th>Faixa</th>
              <th>H / K</th>
              <th>Tm</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group, i) => {
              return (
                <tr key={i}>
                  <td>Q{i + 1}</td>
                  <td>
                    {group.enabled} / {group.registered}
                  </td>
                  <td>
                    {group.registered
                      ? `${((100 * group.enabled) / group.registered).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
                      : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Box>
      <Text fontSize="xs">
        {snapshot.nationalEnabled.toLocaleString('pt-BR')} habilitadas /{' '}
        {snapshot.nationalTotal.toLocaleString('pt-BR')} cadastradas. Inclui
        todas as situações administrativas. Habilitação não é atendimento nem
        aprovação entre solicitantes.
      </Text>
      <Text fontSize="xs">
        Cadastro tratado de 2025. Pontos e detalhes fixados em 2025. IVS do
        projeto: 2010.
      </Text>
    </Stack>
  );
};
const ViewSwitch = ({
  state,
  risks,
}: {
  state: State;
  risks: CadinsanByCity[];
}) => {
  return (
    <Button
      size="xs"
      disabled={!state.snapshot || !risks.length}
      aria-pressed={state.summary ?? false}
      onClick={() => {
        return state.setSummary?.(!state.summary);
      }}
    >
      {state.summary
        ? 'Mostrar círculos divididos'
        : 'Mostrar síntese bivariada'}
    </Button>
  );
};
const ViewKey = ({
  state,
  risks,
}: {
  state: State;
  risks: CadinsanByCity[];
}) => {
  return state.summary ? (
    <MunicipalCoverageMatrix cuts={coverageRiskCuts(risks)} />
  ) : (
    <CircleKey />
  );
};
/** The same reference population serves the map and the pooled evidence table. */
const MunicipalCoverageLegendContent = ({ state }: { state: State }) => {
  const risks = state.cadinsan ?? EMPTY_RISKS;
  return (
    <Stack gap="2">
      <Text fontWeight="bold" fontSize="sm">
        {COVERAGE_TITLE}
      </Text>
      <Text fontSize="xs">
        Onde há maior risco, a proporção habilitada é maior?
      </Text>
      {state.loading && (
        <Text role="status" fontSize="xs">
          Carregando o cadastro de 2025…
        </Text>
      )}
      {state.error && (
        <>
          <Text role="alert" fontSize="xs">
            {state.error}
          </Text>
          <Button size="xs" onClick={state.retry}>
            Tentar novamente
          </Button>
        </>
      )}
      <ViewSwitch state={state} risks={risks} />
      <ViewKey state={state} risks={risks} />
      {!risks.length && (
        <Text role="status" fontSize="xs">
          CADINSAN ainda indisponível. Selecione o mapa CADINSAN para carregar
          ou tentar novamente.
        </Text>
      )}
      <CoverageTable
        snapshot={state.snapshot}
        risks={risks}
        scenario={state.scenario ?? 'com'}
      />
    </Stack>
  );
};
export default MunicipalCoverageLegendContent;
