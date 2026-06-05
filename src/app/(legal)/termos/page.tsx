import { Box, Heading, List, Stack, Text } from '@chakra-ui/react';
import type { Metadata } from 'next';

import Container from '@/components/ui/Container';

export const metadata: Metadata = {
  title: 'Termos de Uso — Cozinhas Solidárias',
};

const TermosHeader = () => {
  return (
    <Stack gap={2}>
      <Heading as="h1" size="2xl">
        Termos de Uso
      </Heading>
      <Text color="fg.muted" fontSize="sm">
        Última atualização: maio de 2026
      </Text>
    </Stack>
  );
};

const TermosPage = () => {
  return (
    <Container>
      <Box maxW="3xl" mx="auto" py={{ base: 10, md: 16 }}>
        <Stack gap={10}>
          <TermosHeader />

          <Stack gap={3}>
            <Heading as="h2" size="lg">
              1. Objeto e aceitação
            </Heading>
            <Text>
              Os presentes Termos de Uso regem o acesso e a utilização da
              plataforma Cozinha Solidária em Rede (&quot;Plataforma&quot;),
              mantida no âmbito do Projeto Cozinhas Solidárias FAPESP. Ao
              acessar ou utilizar a Plataforma, o usuário declara ter lido,
              compreendido e concordado com estes Termos.
            </Text>
          </Stack>

          <Stack gap={3}>
            <Heading as="h2" size="lg">
              2. Descrição da Plataforma
            </Heading>
            <Text>
              A Plataforma é um observatório público de dados sobre cozinhas
              solidárias no Brasil, desenvolvido para fins de pesquisa,
              transparência e mobilização social. Disponibiliza informações,
              indicadores, mapas e publicações relacionadas ao Programa Cozinha
              Solidária e iniciativas correlatas.
            </Text>
          </Stack>

          <Stack gap={3}>
            <Heading as="h2" size="lg">
              3. Uso permitido
            </Heading>
            <Text>O usuário pode acessar e utilizar o conteúdo para:</Text>
            <List.Root ps={4} gap={2}>
              <List.Item>
                Pesquisa acadêmica e análise de políticas públicas.
              </List.Item>
              <List.Item>
                Jornalismo e comunicação de interesse público.
              </List.Item>
              <List.Item>Mobilização comunitária e uso educacional.</List.Item>
              <List.Item>
                Citação e reprodução parcial, desde que atribuída a fonte.
              </List.Item>
            </List.Root>
            <Text>É vedado:</Text>
            <List.Root ps={4} gap={2}>
              <List.Item>
                Uso comercial sem autorização expressa da equipe do projeto.
              </List.Item>
              <List.Item>
                Reprodução sistemática de conjuntos de dados para redistribuição
                sem acordo prévio.
              </List.Item>
              <List.Item>
                Qualquer uso que possa induzir o público a erro sobre a origem
                ou o significado dos dados.
              </List.Item>
            </List.Root>
          </Stack>

          <Stack gap={3}>
            <Heading as="h2" size="lg">
              4. Propriedade intelectual
            </Heading>
            <Text>
              O conteúdo editorial, os textos analíticos e as visualizações
              desenvolvidas pela equipe do projeto estão licenciados sob
              Creative Commons Atribuição 4.0 Internacional (CC BY 4.0), salvo
              indicação contrária. Os dados primários provenientes de fontes
              governamentais são de domínio público. O logotipo e a identidade
              visual do Programa Cozinha Solidária pertencem ao Ministério do
              Desenvolvimento e Assistência Social, Família e Combate à Fome
              (MDS).
            </Text>
          </Stack>

          <Stack gap={3}>
            <Heading as="h2" size="lg">
              5. Qualidade e limitações dos dados
            </Heading>
            <Text>
              A Plataforma integra dados de fontes públicas sujeitos a
              limitações de cobertura, periodicidade e completude. As
              informações são fornecidas &quot;como estão&quot;, sem garantia de
              exatidão absoluta. A equipe emprega metodologias documentadas para
              coleta, validação e tratamento — o usuário deve considerar as
              notas metodológicas antes de usar os dados em publicações ou
              decisões.
            </Text>
          </Stack>

          <Stack gap={3}>
            <Heading as="h2" size="lg">
              6. Limitação de responsabilidade
            </Heading>
            <Text>
              A equipe do Projeto Cozinhas Solidárias não se responsabiliza por
              danos diretos ou indiretos decorrentes do uso ou da
              impossibilidade de uso da Plataforma, nem pela eventual incorreção
              de dados provenientes de fontes externas devidamente
              identificadas.
            </Text>
          </Stack>

          <Stack gap={3}>
            <Heading as="h2" size="lg">
              7. Links externos
            </Heading>
            <Text>
              A Plataforma pode conter links para sites de terceiros. Esses
              links são fornecidos apenas para conveniência e não implicam
              endosso de seu conteúdo.
            </Text>
          </Stack>

          <Stack gap={3}>
            <Heading as="h2" size="lg">
              8. Modificações
            </Heading>
            <Text>
              Estes Termos podem ser alterados a qualquer tempo. As alterações
              entram em vigor na data de sua publicação. O uso continuado da
              Plataforma após a publicação das alterações constitui aceitação
              dos novos Termos.
            </Text>
          </Stack>

          <Stack gap={3}>
            <Heading as="h2" size="lg">
              9. Lei aplicável e foro
            </Heading>
            <Text>
              Estes Termos são regidos pela legislação brasileira. Fica eleito o
              foro da Comarca de São Paulo/SP para resolução de conflitos
              decorrentes deste instrumento.
            </Text>
          </Stack>

          <Stack gap={3}>
            <Heading as="h2" size="lg">
              10. Contato
            </Heading>
            <Text>
              Dúvidas e solicitações podem ser encaminhadas pelo formulário
              disponível na página Contato.
            </Text>
          </Stack>
        </Stack>
      </Box>
    </Container>
  );
};

export default TermosPage;
