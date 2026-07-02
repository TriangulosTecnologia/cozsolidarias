import { Box, HStack, Stack, Text } from '@chakra-ui/react';

import type { KitchenEnrichment, PaaProduct } from '@/data-gateway/schema';

import SourcedField from './SourcedField';

type KitchenDossierProps = {
  enrichment: KitchenEnrichment;
};

const formatNumber = (value: number | null): string | null => {
  return value === null ? null : value.toLocaleString('pt-BR');
};

const formatBoolean = (value: boolean | null): string | null => {
  if (value === null) {
    return null;
  }
  return value ? 'Sim' : 'Não';
};

const formatProducts = (products: PaaProduct[] | null): string | null => {
  if (!products || products.length === 0) {
    return null;
  }
  return products
    .map((product) => {
      return `${product.produto} (${product.kg.toLocaleString('pt-BR')} kg)`;
    })
    .join(', ');
};

const formatExamples = (examples: string[] | null): string | null => {
  if (!examples || examples.length === 0) {
    return null;
  }
  return examples.join('; ');
};

const SectionHeading = ({ title, hint }: { title: string; hint?: string }) => {
  return (
    <HStack justify="space-between" align="baseline">
      <Text textStyle="body" fontWeight="600" color="text.primary">
        {title}
      </Text>
      {hint ? (
        <Text textStyle="caption" color="text.secondary">
          {hint}
        </Text>
      ) : null}
    </HStack>
  );
};

/**
 * Renders the supply/public-policy enrichment of the selected kitchen in three
 * provenance-carrying groups: official status, self-reported sourcing (omitted
 * when unavailable), and the federal supply network in its município. When both
 * PAA and CAF counts are zero, a qualitative "supply desert" note is shown.
 *
 * @example
 * <KitchenDossier enrichment={enrichment} />
 */
const KitchenDossier = ({ enrichment }: KitchenDossierProps) => {
  const { status, sourcing, supplyNetwork } = enrichment;
  const isDesert =
    supplyNetwork.paaReceivingUnits.value === 0 &&
    supplyNetwork.cafOrganizations.value === 0;

  return (
    <Stack gap={5} mb={4}>
      <Stack gap={3}>
        <SectionHeading title="Situação oficial" />
        <SourcedField
          label="Situação"
          value={status.situacao.value}
          source={status.situacao.source}
          note={status.situacao.note}
          emptyText="Não consta no Banco"
        />
        <SourcedField
          label="Em funcionamento"
          value={status.emFuncionamento.value}
          source={status.emFuncionamento.source}
          note={status.emFuncionamento.note}
          emptyText="Não consta no Banco"
        />
        <SourcedField
          label="Refeições por dia"
          value={formatNumber(status.refeicoesPorDia.value)}
          source={status.refeicoesPorDia.source}
          note={status.refeicoesPorDia.note}
        />
      </Stack>

      {sourcing ? (
        <Stack gap={3}>
          <SectionHeading
            title="Como se abastece hoje"
            hint="autodeclarado 2024"
          />
          <SourcedField
            label="Como adquire alimentos"
            value={sourcing.comoAdquire.value}
            source={sourcing.comoAdquire.source}
            note={sourcing.comoAdquire.note}
          />
          <SourcedField
            label="Gasto mensal com alimentos"
            value={sourcing.gastoMensalTexto.value}
            source={sourcing.gastoMensalTexto.source}
            note={sourcing.gastoMensalTexto.note}
          />
          <SourcedField
            label="Pessoas que trabalham"
            value={sourcing.trabalhadores.value}
            source={sourcing.trabalhadores.source}
            note={sourcing.trabalhadores.note}
          />
        </Stack>
      ) : null}

      <Stack gap={3}>
        <SectionHeading
          title="Rede de abastecimento no município"
          hint={supplyNetwork.municipio}
        />
        {isDesert ? (
          <Box borderLeftWidth="3px" borderColor="action.fg" pl={3} py={1}>
            <Text textStyle="caption" color="text.secondary">
              Sem rede federal de abastecimento mapeada neste município — nem
              unidades recebedoras do PAA, nem organizações da agricultura
              familiar (CAF). Um &ldquo;deserto&rdquo; de abastecimento
              institucional.
            </Text>
          </Box>
        ) : null}
        <SourcedField
          label="Unidades recebedoras do PAA (município)"
          value={formatNumber(supplyNetwork.paaReceivingUnits.value)}
          source={supplyNetwork.paaReceivingUnits.source}
          note={supplyNetwork.paaReceivingUnits.note}
        />
        <SourcedField
          label="Esta cozinha recebe do PAA?"
          value={formatBoolean(supplyNetwork.isPaaReceiver.value)}
          source={supplyNetwork.isPaaReceiver.source}
          note={supplyNetwork.isPaaReceiver.note}
        />
        <SourcedField
          label="Principais produtos do PAA (município)"
          value={formatProducts(supplyNetwork.paaProducts.value)}
          source={supplyNetwork.paaProducts.source}
          note={supplyNetwork.paaProducts.note}
          emptyText="Sem produtos registrados"
        />
        <SourcedField
          label="Organizações da agricultura familiar (CAF)"
          value={formatNumber(supplyNetwork.cafOrganizations.value)}
          source={supplyNetwork.cafOrganizations.source}
          note={supplyNetwork.cafOrganizations.note}
        />
        <SourcedField
          label="Exemplos de organizações (CAF)"
          value={formatExamples(supplyNetwork.cafExamples.value)}
          source={supplyNetwork.cafExamples.source}
          note={supplyNetwork.cafExamples.note}
          emptyText="Sem organizações no município"
        />
      </Stack>
    </Stack>
  );
};

export default KitchenDossier;
