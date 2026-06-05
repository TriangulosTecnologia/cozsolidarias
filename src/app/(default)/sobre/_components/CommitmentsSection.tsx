import { Box, SimpleGrid, Stack, Text } from '@chakra-ui/react';

import Container from '@/components/ui/Container';

type CommitmentItem = { title: string; text: string; application: string };

const ITEMS: CommitmentItem[] = [
  {
    title: 'Território',
    text: 'Cada registro deve ser lido em contexto.',
    application: 'Não comparar regiões sem explicitar cobertura e fonte.',
  },
  {
    title: 'Transparência',
    text: 'Toda visualização deve preservar fonte, data e limite.',
    application: 'Exibir metadados junto de mapas, cards e indicadores.',
  },
  {
    title: 'Cuidado',
    text: 'Informação sensível exige precisão, privacidade e respeito.',
    application:
      'Usar localização aproximada quando houver risco ou imprecisão.',
  },
  {
    title: 'Rastreabilidade',
    text: 'O caminho entre fonte, tratamento e visualização deve ser compreensível.',
    application:
      'Permitir leitura do percurso entre dado bruto e dado exibido.',
  },
  {
    title: 'Devolução',
    text: 'O conhecimento produzido deve retornar às redes e territórios.',
    application: 'Criar caminhos para correção, colaboração e uso público.',
  },
];

type CardProps = {
  item: CommitmentItem;
};

/**
 * Single commitment card.
 * `application` text is hidden on desktop until hover/focus; always visible on mobile.
 *
 * @param item - Commitment data with title, text, and application.
 *
 * @example
 * <CommitmentCard item={items[0]} />
 */
const CommitmentCard = ({ item }: CardProps) => {
  return (
    <Box
      p={7}
      bg="ivory.50"
      borderRadius="card"
      border="1px solid"
      borderColor="ivory.300"
      cursor="default"
      tabIndex={0}
      data-group
      transition="border-color 0.2s ease-out, box-shadow 0.2s ease-out"
      _hover={{ borderColor: 'verde.600', boxShadow: 'card' }}
      _focusVisible={{ borderColor: 'verde.600', boxShadow: 'card' }}
    >
      <Stack gap={3}>
        <Text textStyle="eyebrow" color="verde.600">
          {item.title}
        </Text>
        <Text textStyle="body-sm" color="charcoal.900" fontWeight="500">
          {item.text}
        </Text>
        {/* Application — always visible on mobile; revealed on hover/focus on desktop */}
        <Text
          textStyle="caption"
          color="charcoal.500"
          opacity={{ base: 1, lg: 0 }}
          transform={{ base: 'none', lg: 'translateY(4px)' }}
          transition="opacity 0.2s ease-out, transform 0.2s ease-out"
          _groupHover={{ opacity: 1, transform: 'none' }}
          _groupFocus={{ opacity: 1, transform: 'none' }}
        >
          {item.application}
        </Text>
      </Stack>
    </Box>
  );
};

/**
 * CommitmentsSection — five commitment principles governing data use.
 * 3-column grid on desktop, 2-column on tablet, 1-column on mobile.
 *
 * @example
 * <CommitmentsSection />
 */
const CommitmentsSection = () => {
  return (
    <Box
      as="section"
      py="clamp(3rem, calc(2.25rem + 3vw), 6rem)"
      bg="ivory.100"
      aria-labelledby="commitments-heading"
    >
      <Container>
        <Stack gap="clamp(2rem, calc(1.5rem + 2vw), 4rem)">
          <Box maxW="64ch">
            <Text textStyle="eyebrow" color="verde.600" mb={4}>
              Compromissos
            </Text>
            <Text
              as="h2"
              id="commitments-heading"
              textStyle="title-2"
              color="charcoal.900"
            >
              Informação pública precisa ser legível, rastreável e responsável.
            </Text>
          </Box>

          <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
            {ITEMS.map((item) => {
              return <CommitmentCard key={item.title} item={item} />;
            })}
          </SimpleGrid>
        </Stack>
      </Container>
    </Box>
  );
};

export default CommitmentsSection;
