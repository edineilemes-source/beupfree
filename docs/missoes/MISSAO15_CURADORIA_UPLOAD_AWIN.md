# Missão 15 — Upload de feeds AWIN na Curadoria administrativa

## Implementado
- Nova interface em `/admin/curadoria/feeds`, ligada pelo botão **Feeds de parceiros (AWIN)** da tela `/admin/curadoria/listas`.
- Seleção do arquivo `.csv.gz` diretamente do computador, IDs do anunciante/feed, chave administrativa e relatório de preço regular, promoção, escopo e elegibilidade.
- API `GET /api/admin/awin-feeds/status` e `POST /api/admin/awin-feeds/upload`:
  - Habilitação **apenas em ambiente não produtivo**, com chave forte guardada fora do Git e permissão `0600`; envio de credencial via header na mesma origem.
  - Recebe GZIP em até 20 MiB, limita descompressão a 160 MiB e 100.000 linhas, verifica ID de anunciante e de feed de cada registro.
  - Reaproveita exatamente a classificação AWIN do backend (`assessAwinCatalogCandidate`), gera relatório sem registrar URLs afiliadas e calcula hash SHA256 do feed.
  - Armazena arquivo com nome seguro/hash em `~/.local/share/uppulse/awin-inbox/` (fora de checkouts e snapshots temporários); não exige que o usuário navegue em `missao9/codigo`.
  - **Nenhuma operação de banco, importação, ativação de ofertas ou publicação** ocorre no upload.
- Teste HTTP com token incorreto e origem diferente rejeitados, upload GZIP autêntico aceito, arquivo persistido fora do repositório.

## Primeiro acesso e autenticação
A chave não pode ser exibida por API desprotegida nem colocada no Issue/GitHub. O administrador executa uma única vez no terminal do Codespaces:
`bash scripts/setup-awin-feed-upload.sh`
A chave gerada aparece somente no terminal; copiar para o campo **Chave administrativa**. O backend consegue ler a chave automaticamente, sem reiniciar a aplicação. Atualizar a tela se ela estava aberta antes.
O script não substitui credenciais AWIN nem concede permissões a terceiros.
**A URL só existe no preview que contiver a versão desta missão**; não confundir o código do GitHub com a versão antiga da porta 5013.

## Próximos passos
- Usar Olympikus 17698/51837 como teste real, depois homologar arquivos de parceiros adicionais.
- Um segundo passo deverá permitir a aprovação expressa do staging e acionar importação multi-fornecedor com backup, checagem de contagens e reversão; o upload inicial deliberadamente não aciona mudanças comerciais.
- Não publicar rota administrativa na Hostinger sem implementação independente de autenticação/roles, auditoria e plano de implantação. A tela fica ausente em PUBLIC_DEMO_MODE.
