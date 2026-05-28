import { Box, Heading, List, Stack, Text } from '@chakra-ui/react';
import type { Metadata } from 'next';

import Container from '@/components/ui/Container';

export const metadata: Metadata = {
  title: 'Política de Cookies — Cozinhas Solidárias',
};

export default function CookiesPage() {
  return (
    <Container>
      <Box maxW="3xl" mx="auto" py={{ base: 10, md: 16 }}>
        <Stack gap={10}>
          <Stack gap={2}>
            <Heading as="h1" size="2xl">
              Política de Cookies
            </Heading>
            <Text color="fg.muted" fontSize="sm">
              Última atualização: maio de 2026
            </Text>
          </Stack>

          <Stack gap={3}>
            <Heading as="h2" size="lg">
              1. O que são cookies
            </Heading>
            <Text>
              Cookies são pequenos arquivos de texto armazenados no seu
              dispositivo quando você visita um site. Eles permitem que o site
              reconheça o dispositivo em acessos posteriores e melhore a
              experiência de navegação.
            </Text>
          </Stack>

          <Stack gap={3}>
            <Heading as="h2" size="lg">
              2. Cookies que utilizamos
            </Heading>
            <Text>
              Esta Plataforma utiliza exclusivamente cookies essenciais —
              necessários para o funcionamento técnico do site. Não utilizamos
              cookies de rastreamento, publicidade ou análise comportamental de
              terceiros.
            </Text>
            <Stack
              gap={4}
              ps={4}
              borderLeftWidth="2px"
              borderColor="border.subtle"
            >
              <Stack gap={1}>
                <Text fontWeight="semibold">Cookies de sessão</Text>
                <Text fontSize="sm" color="fg.muted">
                  Mantêm o estado da navegação durante a visita. São apagados
                  automaticamente ao fechar o navegador.
                </Text>
              </Stack>
              <Stack gap={1}>
                <Text fontWeight="semibold">Cookies de preferência</Text>
                <Text fontSize="sm" color="fg.muted">
                  Armazenam configurações locais, como filtros e visualizações
                  selecionados pelo usuário. Persistem entre visitas no mesmo
                  dispositivo.
                </Text>
              </Stack>
            </Stack>
          </Stack>

          <Stack gap={3}>
            <Heading as="h2" size="lg">
              3. Finalidade
            </Heading>
            <Text>Os cookies essenciais servem para:</Text>
            <List.Root ps={4} gap={2}>
              <List.Item>
                Garantir a navegação entre páginas sem perda de contexto.
              </List.Item>
              <List.Item>
                Lembrar preferências de exibição (ex.: filtros ativos no mapa e
                nas tabelas).
              </List.Item>
              <List.Item>
                Assegurar o correto funcionamento de formulários.
              </List.Item>
            </List.Root>
            <Text>
              Não utilizamos esses dados para identificar usuários
              individualmente nem os compartilhamos com terceiros.
            </Text>
          </Stack>

          <Stack gap={3}>
            <Heading as="h2" size="lg">
              4. Como gerenciar cookies
            </Heading>
            <Text>
              Você pode configurar seu navegador para bloquear ou excluir
              cookies. Veja as instruções para os principais navegadores:
            </Text>
            <List.Root ps={4} gap={2}>
              <List.Item>
                <strong>Chrome:</strong> Configurações → Privacidade e segurança
                → Cookies e outros dados do site.
              </List.Item>
              <List.Item>
                <strong>Firefox:</strong> Configurações → Privacidade e
                Segurança → Cookies e dados de sites.
              </List.Item>
              <List.Item>
                <strong>Safari:</strong> Preferências → Privacidade → Gerenciar
                dados de sites.
              </List.Item>
              <List.Item>
                <strong>Edge:</strong> Configurações → Cookies e permissões de
                site → Gerenciar e excluir cookies.
              </List.Item>
            </List.Root>
            <Text>
              O bloqueio de cookies essenciais pode prejudicar o funcionamento
              de algumas funcionalidades da Plataforma.
            </Text>
          </Stack>

          <Stack gap={3}>
            <Heading as="h2" size="lg">
              5. LGPD e proteção de dados
            </Heading>
            <Text>
              Esta Plataforma está comprometida com os princípios da Lei Geral
              de Proteção de Dados (Lei nº 13.709/2018). Os cookies utilizados
              não coletam dados pessoais identificáveis. Para exercer seus
              direitos como titular de dados ou esclarecer dúvidas, utilize o
              formulário na página Contato.
            </Text>
          </Stack>

          <Stack gap={3}>
            <Heading as="h2" size="lg">
              6. Atualizações desta política
            </Heading>
            <Text>
              Esta política pode ser atualizada para refletir mudanças técnicas
              ou legais. A data de revisão será sempre indicada no topo da
              página. Recomendamos consulta periódica.
            </Text>
          </Stack>
        </Stack>
      </Box>
    </Container>
  );
}
