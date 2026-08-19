import { Box, Table, Text } from '@chakra-ui/react';

import type { CatalogueFieldContract } from '../../../../data-gateway/schema';
import { labelOf, ROLE_LABELS } from './catalogueLabels';

type Props = {
  /** Fields of one dataset, in the order the catalogue declares them. */
  fields: CatalogueFieldContract[];
  /** Accessible caption naming the dataset the dictionary belongs to. */
  datasetTitle: string;
};

/**
 * Field-level data dictionary of a single dataset: the name each column carries
 * in the source, what it means, its semantic role and its unit. Fields flagged
 * as sensitive are marked — the page publishes the *names* of personal-data
 * columns as LGPD transparency, never their values.
 *
 * Scrolls horizontally inside its own container on narrow viewports so the page
 * body never scrolls sideways. Server Component.
 *
 * @param fields - The dataset's fields; an empty list renders an explicit note.
 * @param datasetTitle - Used as the table caption for screen readers.
 *
 * @example
 * <DataDictionary fields={dataset.fields} datasetTitle={dataset.title} />
 */
const DataDictionary = ({ fields, datasetTitle }: Props) => {
  if (fields.length === 0) {
    return (
      <Text textStyle="body-sm" color="charcoal.500">
        Este dataset ainda não tem o dicionário de campos documentado.
      </Text>
    );
  }

  return (
    <Box overflowX="auto">
      <Table.Root size="sm" variant="line" minW="42rem">
        <Table.Caption srOnly>
          Dicionário de dados de {datasetTitle}
        </Table.Caption>
        <Table.Header>
          <Table.Row bg="transparent">
            <Table.ColumnHeader
              color="charcoal.500"
              fontSize="0.75rem"
              textTransform="uppercase"
              letterSpacing="0.08em"
              fontWeight="500"
              borderColor="ivory.300"
            >
              Campo
            </Table.ColumnHeader>
            <Table.ColumnHeader
              color="charcoal.500"
              fontSize="0.75rem"
              textTransform="uppercase"
              letterSpacing="0.08em"
              fontWeight="500"
              borderColor="ivory.300"
            >
              Descrição
            </Table.ColumnHeader>
            <Table.ColumnHeader
              color="charcoal.500"
              fontSize="0.75rem"
              textTransform="uppercase"
              letterSpacing="0.08em"
              fontWeight="500"
              borderColor="ivory.300"
            >
              Papel
            </Table.ColumnHeader>
            <Table.ColumnHeader
              color="charcoal.500"
              fontSize="0.75rem"
              textTransform="uppercase"
              letterSpacing="0.08em"
              fontWeight="500"
              borderColor="ivory.300"
            >
              Unidade
            </Table.ColumnHeader>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {fields.map((field) => {
            return (
              <Table.Row key={field.name} bg="transparent">
                <Table.Cell borderColor="ivory.300" verticalAlign="top">
                  <Text
                    as="code"
                    textStyle="body-sm"
                    color="charcoal.900"
                    fontFamily="mono"
                    wordBreak="break-word"
                  >
                    {field.name}
                  </Text>
                  {field.sensitive ? (
                    <Text textStyle="caption" color="roxo.600" mt={1}>
                      dado sensível
                    </Text>
                  ) : null}
                </Table.Cell>
                <Table.Cell
                  borderColor="ivory.300"
                  verticalAlign="top"
                  color="charcoal.700"
                  textStyle="body-sm"
                >
                  {field.description}
                </Table.Cell>
                <Table.Cell
                  borderColor="ivory.300"
                  verticalAlign="top"
                  color="charcoal.700"
                  textStyle="body-sm"
                  whiteSpace="nowrap"
                >
                  {field.role === null ? '—' : labelOf(ROLE_LABELS, field.role)}
                </Table.Cell>
                <Table.Cell
                  borderColor="ivory.300"
                  verticalAlign="top"
                  color="charcoal.700"
                  textStyle="body-sm"
                  whiteSpace="nowrap"
                >
                  {field.unit ?? '—'}
                </Table.Cell>
              </Table.Row>
            );
          })}
        </Table.Body>
      </Table.Root>
    </Box>
  );
};

export default DataDictionary;
