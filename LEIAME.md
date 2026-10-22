# Checklist Brigada — Dois Marcos Sementes

São duas versões que usam o mesmo banco de dados (Supabase):

| Versão | Endereço | Para quem | O que faz |
|---|---|---|---|
| **App da brigada** (celular) | `https://SEU-USUARIO.github.io/REPOSITORIO/` | Brigadistas | Escolher o nome, ler o QR Code, fazer o checklist, ver "Meus equipamentos" (agrupados por setor) |
| **Gestão** (PC) | `https://SEU-USUARIO.github.io/REPOSITORIO/gestao.html` | Coordenação (entra com PIN) | Painel, setores, duplas e brigadistas, equipamentos, histórico, etiquetas QR, configuração |

**Como a responsabilidade funciona:** Brigadista → **Dupla** → **Setor** → Equipamentos. O **setor é a Localização do equipamento** (ex.: "ARMAZÉM REFRIGERADO 01", "TSI - ESCADAS", "GERADORES"). Cada setor tem uma dupla, e **todos** os equipamentos daquela localização ficam com ela. O vínculo é sempre pelo setor, nunca por equipamento.

**Leitura do QR obrigatória:** o checklist só pode ser feito lendo a etiqueta no local.
- Cada equipamento tem um **código secreto** (coluna `token` da tabela `equipamentos`), criado pelo próprio banco. Ele vai impresso dentro do QR e **nunca** é enviado ao app nem ao GitHub.
- O banco só grava o checklist se vier com o código certo. Sem ler a etiqueta, não grava.
- No celular não existe digitação de código, e a lista "Meus equipamentos" é só consulta.
- Cada leitura vale para **um** checklist e por **30 minutos**. Depois de lido, o código some do endereço da página.
- Etiqueta fotografada ou copiada: use **"trocar código"** em Etiquetas QR. A antiga para de funcionar na hora.

## Arquivos

| Arquivo | Vai para o GitHub? | O que é |
|---|---|---|
| `index.html` | sim | App da brigada (celular) |
| `gestao.html` | sim | Gestão (PC) |
| `comum.js` | sim | Código comum. **Aqui ficam a configuração do Supabase e os itens dos checklists** |
| `estilo.css` | sim | Visual |
| `brigada.png` | sim | Logo da Brigada de Emergência: topo, ícone do app, login da gestão e etiquetas |
| `logo.png` | sim | **Coloque aqui o logo oficial** com este nome exato. Sem ele, o espaço do logo some |
| `supabase/schema.sql` | sim | Estrutura do banco: tabelas, regras de segurança e funções |
| `supabase/dados-iniciais.sql` | **não** | Cadastro inicial: 47 brigadistas, 210 setores e 344 equipamentos. **Tem nomes de pessoas**: roda no Supabase e fica só nesta pasta |
| `dados-iniciais.js` | **não** | O mesmo cadastro, para o modo demonstração local |

## Instalação

### 1. Supabase (banco de dados)
1. Crie uma conta gratuita em **supabase.com** e um projeto novo (região: São Paulo). Guarde a senha do banco.
2. Abra **SQL Editor › New query**, cole o conteúdo de `supabase/schema.sql` e clique **Run**.
3. Nova query: cole `supabase/dados-iniciais.sql` e clique **Run**. Deve mostrar 47 brigadistas, 210 setores e 344 equipamentos.
4. Nova query: `select definir_pin('SEU-PIN');` (troque pelo PIN da coordenação) e clique **Run**.
5. Em **Project Settings › API**, copie a **Project URL** e a chave **anon public**.
   **Nunca** use a chave `service_role` no app.

### 2. Configurar o app
Abra `comum.js` e preencha:
```js
SUPABASE_URL: 'https://xxxxx.supabase.co',
SUPABASE_KEY: 'eyJ...',   // chave anon public
```

### 3. GitHub Pages
1. Em **github.com**, crie um repositório **público** e **vazio** (sem README).
2. Envie os arquivos desta pasta: `git push`. O `.gitignore` já deixa de fora os arquivos com nomes.
3. No repositório: **Settings › Pages › Source: Deploy from a branch › Branch: main / (root) › Save**.
4. Em 1 a 2 minutos o app fica no ar.

### 4. Primeiro uso (no PC)
1. Abra `…/gestao.html` e entre com o PIN.
2. **Setores**: filtre "Sem dupla" (são 40, ex.: GERADORES, PIT STOP, TANQUE DE COMBUSTÍVEL), marque vários e aplique a dupla de uma vez. Confira também as 170 duplas sugeridas a partir dos hidrantes.
3. **Duplas e brigadistas**: troque integrantes, crie duplas, cadastre ou desative brigadistas.
4. **Etiquetas QR**: imprima todas em papel adesivo, **pelo endereço do GitHub Pages**, e cole em cada equipamento.
5. **Configuração**: link e QR Code do app para mandar aos brigadistas.

## Se o login não funcionar no celular

- Abra o link no **Chrome (Android)** ou no **Safari (iPhone)**. Navegadores embutidos (abrir de dentro do WhatsApp, OneDrive ou e-mail) podem bloquear o salvamento. O app avisa numa faixa amarela.

## Manutenção do dia a dia

- **Novo equipamento**: no Supabase, **Table Editor › equipamentos › Insert row** (código, categoria, tipo, local). Deixe o `token` em branco: o banco cria o código sozinho. Se a localização já existir, ele já entra na dupla daquele setor. Se for nova, aparece em Setores como "sem dupla". Depois imprima a etiqueta.
- **Alarmes (acionadores manuais)**: cadastre na tabela `equipamentos` com `categoria` = `Alarme` (ex.: código `ALM-001`). Eles usam o checklist de alarmes (Integridade, Teste funcional, Placa de sinalização, Pintura do piso, Acesso livre) e aparecem com a ilustração da botoeira.
- **Checklists usados**: extintores e alarmes conforme a planilha "CKL extintores e alarmes"; hidrante com abrigo conforme o formulário "Checklist de verificação – Sistema de hidrantes". Os 2 acionamentos manuais de pressurização usam o checklist de alarmes.
- **Desativar equipamento**: na mesma tabela, desmarque `ativo`.
- **Brigadistas e duplas**: pela gestão.
- **Mudar os itens do checklist**: edite `CHECKLISTS` no `comum.js` e envie para o GitHub.
- **Trocar o PIN**: no SQL Editor, `select definir_pin('NOVO-PIN');`
- **Relatórios**: na gestão, Painel e Histórico exportam CSV. No Supabase, a tabela `registros` tem tudo.

## Observações

- Regra mensal: cada equipamento precisa de pelo menos 1 checklist por mês. O status do mês é o do checklist mais recente.
- O brigadista se identifica escolhendo o nome, sem senha. A gestão pede o PIN, que é conferido pelo banco.
- Os nomes dos brigadistas não ficam no GitHub, mas o app precisa lê-los para a tela de login. Por isso, quem tiver o link do app consegue ver a lista de nomes.
- Limite da leitura obrigatória: ela prova que **alguém leu a etiqueta**, mas não impede o uso de uma foto do QR. Para isso existe o "trocar código".
- O setor usa o texto da localização exatamente como está cadastrado. "ARMAZÉM REFRIGERADO 17" e "ARMAZÉM REFRIGERADO 17 (porta de emergência)" são setores diferentes; use a busca e a marcação em lote.
- **Modo demonstração** (Supabase não configurado): roda só localmente, com os dados no navegador. Serve para testar.
