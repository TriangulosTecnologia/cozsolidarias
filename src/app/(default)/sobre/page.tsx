import { Box, Heading, Stack, Text } from '@chakra-ui/react';
import type { Metadata } from 'next';

import Container from '@/components/ui/Container';

export const metadata: Metadata = {
  title: 'Sobre — Cozinhas Solidárias',
};

export default function SobrePage() {
  return (
    <Container>
      <Box maxW="3xl" mx="auto" py={{ base: 10, md: 16 }}>
        <Stack gap={8}>
          <Heading as="h1" size="2xl">
            Sobre
          </Heading>

          <Text fontSize="lg" fontWeight="medium">
            As Cozinhas Solidárias são infraestruturas comunitárias de combate à
            fome.
          </Text>

          <Text>
            Elas nascem onde a insegurança alimentar é concreta: nos territórios
            em que a ausência de renda, abastecimento, serviços públicos e
            proteção social se converte em falta de comida. Sua força está na
            combinação entre organização popular, preparo coletivo de refeições,
            cuidado cotidiano e capacidade de chegar a pessoas que muitas
            políticas públicas alcançam tarde ou não alcançam.
          </Text>

          <Text fontWeight="semibold" color="brand.fg">
            Esta plataforma existe para tornar essa rede visível, compreensível
            e acionável.
          </Text>

          <Text>
            Reunimos dados, documentos, registros territoriais e evidências
            sobre cozinhas solidárias no Brasil para apoiar quem pesquisa,
            formula políticas, executa projetos, comunica a agenda pública ou
            atua diretamente nos territórios. O objetivo não é reduzir as
            cozinhas a números, mas criar uma base comum para compreender sua
            escala, sua diversidade, suas necessidades e sua potência.
          </Text>

          <Stack gap={6}>
            <Heading as="h2" size="lg">
              Nossos compromissos
            </Heading>

            <Stack
              gap={3}
              ps={5}
              borderLeftWidth="3px"
              borderColor="brand.solid"
            >
              <Text fontWeight="semibold">Com o território</Text>
              <Text>
                Cada cozinha opera em uma realidade própria: bairro, comunidade,
                ocupação, periferia urbana, rede de apoio, entidade gestora,
                movimento social, igreja, associação ou coletivo local. Por
                isso, os dados são tratados como expressão de contextos, não
                como linhas isoladas em uma tabela.
              </Text>
            </Stack>

            <Stack
              gap={3}
              ps={5}
              borderLeftWidth="3px"
              borderColor="brand.solid"
            >
              <Text fontWeight="semibold">Com a transparência</Text>
              <Text>
                Toda informação deve indicar fonte, data, cobertura, limite e
                grau de confiança. Quando um dado não está identificado, ele
                deve permanecer assim. A plataforma não preenche lacunas com
                suposições; ela torna as lacunas visíveis para que possam ser
                corrigidas, qualificadas ou investigadas.
              </Text>
            </Stack>

            <Stack
              gap={3}
              ps={5}
              borderLeftWidth="3px"
              borderColor="brand.solid"
            >
              <Text fontWeight="semibold">Com a ação pública</Text>
              <Text>
                Mapas, indicadores, catálogos e relatórios só importam se
                ajudarem a melhorar decisões: onde apoiar, como abastecer, que
                parcerias formar, quais territórios priorizar, que evidências
                produzir e quais políticas fortalecer.
              </Text>
            </Stack>
          </Stack>

          <Text>
            As Cozinhas Solidárias articulam alimentação, cuidado, logística,
            saúde, educação alimentar, agricultura familiar, mobilização social
            e presença comunitária. Em muitos casos, a refeição é apenas a parte
            mais visível de uma rede mais ampla de proteção e vínculo.
          </Text>

          <Text fontWeight="medium">
            Esta plataforma organiza essa complexidade.
          </Text>

          <Stack
            gap={2}
            ps={5}
            borderLeftWidth="3px"
            borderColor="border.subtle"
          >
            <Text color="fg.muted">
              Aqui, dados não substituem o território; ajudam a escutá-lo
              melhor.
            </Text>
            <Text color="fg.muted">
              Mapas não encerram a realidade; mostram onde olhar com mais
              precisão.
            </Text>
            <Text color="fg.muted">
              Indicadores não falam sozinhos; precisam de método, contexto e
              responsabilidade.
            </Text>
          </Stack>

          <Stack gap={3}>
            <Text>
              O projeto Cozinhas Solidárias é uma iniciativa de pesquisa,
              organização de dados e apoio técnico voltada a fortalecer a
              inteligência pública sobre a fome e as respostas comunitárias que
              a enfrentam.
            </Text>
            <Text fontWeight="medium">
              Sua finalidade é simples: transformar informação dispersa em
              conhecimento útil, verificável e orientado à ação.
            </Text>
          </Stack>
        </Stack>
      </Box>
    </Container>
  );
}
