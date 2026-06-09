# CLAUDE.md — Skala Financeiro

> Este arquivo é lido automaticamente pelo Claude Code a cada sessão.
> Contém tudo que o Claude precisa saber para trabalhar neste projeto com precisão.

---

## 🏢 Contexto do Projeto

**Produto:** Sistema financeiro interno da Skala Contabilidade (Balneário Camboriú - SC).
**Objetivo:** Gestão financeira do escritório — lançamentos, DRE, Fluxo de Caixa, Contas a Receber/Pagar.
**Desenvolvedor:** Otávio Niehues — iniciante em programação, usa Claude Code como par técnico.
**Regra de ouro:** Sempre explique o que está fazendo e por quê. Nunca assuma que o usuário sabe o que é óbvio para um programador.
**Visual:** Sempre use a identidade visual da Skala ao criar ou editar elementos visuais. 

---

## 🏗️ Arquitetura

```
/
├── financeiro.html        # HTML principal — toda a estrutura da SPA
├── financeiro.css         # Todos os estilos
├── js/
│   ├── 01-core.js         # Supabase, auth, funções globais, toRow/fromRow
│   ├── 02-relatorios.js   # Dashboard, DRE, Fluxo de Caixa, Extrato
│   ├── 03-lancamentos.js  # Tabelas de Contas a Receber/Pagar, filtros, form
│   ├── 04-cadastros.js    # Categorias, Contas, Recorrentes, Transferências
│   └── 05-importacoes.js  # Importar Faturamento (CSV/XLS) + Baixar por Relatório
└── .htaccess              # Apache: todas as rotas → financeiro.html
```

**Stack:**
- Frontend: HTML/CSS/JS puro — sem framework, sem bundler, sem NPM
- Backend: Supabase REST API (fetch direto para `/rest/v1/`)
- Hospedagem: servidor local Apache, path base `/Skala-F/` para teste e hostinger depois de pronto
- Autenticação: JWT via Supabase Auth, token em `localStorage`

**Regra:** Não introduzir frameworks, bundlers ou dependências externas sem discutir primeiro. O projeto é vanilla JS por design.

---

## 🗄️ Banco de Dados (Supabase)

### Tabelas existentes
| Tabela | Descrição |
|---|---|
| `lancamentos` | Todos os lançamentos financeiros |
| `categorias` | Categorias de receita (R) e despesa (D) |
| `subcategorias` | Subcategorias vinculadas às categorias |
| `recorrentes` | Despesas recorrentes fixas |
| `contas` | Contas bancárias cadastradas |

### Tabelas a criar (roadmap)
| Tabela | Fase |
|---|---|
| `clientes` | Fase 3 |

### ⚠️ REGRA CRÍTICA — Toda tabela nova precisa de GRANT + RLS

```sql
-- Executar no SQL Editor do Supabase para TODA tabela nova:
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.nome_da_tabela
  TO authenticated;

GRANT SELECT
  ON public.nome_da_tabela
  TO anon;

ALTER TABLE public.nome_da_tabela
  ENABLE ROW LEVEL SECURITY;
```

**Prazo:** O Supabase muda as permissões padrão em 30/10/2026. Tabelas existentes funcionam até lá, mas TODA tabela nova já deve ter esses grants desde o início.

**Antes de outubro/2026:** Revisar grants/RLS das tabelas existentes no Supabase Dashboard → Security Advisor.

---

## 📦 Modelo de Dados — Lançamentos

### toRow() — app → banco
```javascript
function toRow(l) {
  return {
    id: l.id,
    tipo: l.tipo,                    // 'R' (Receita) ou 'D' (Despesa)
    data_comp: l.dataComp || null,   // formato: 'YYYY-MM-01'
    data_pgto: l.dataPgto || null,   // formato: 'YYYY-MM-DD'
    data_venc: l.dataVenc || null,   // ⚠️ coluna JÁ EXISTE no banco — falta mapear no código (item #3)
    cat: l.cat,
    sub: l.sub || null,
    descricao: l.desc || null,
    cc: l.cc || null,                // código do cliente (texto livre hoje → FK futura)
    forma: l.forma || null,
    conta: normalizeConta(l.conta) || null,
    doc: l.doc || null,
    valor_bruto: parseMoney(l.valorBruto),
    ded: parseMoney(l.ded),
    valor_liq: parseMoney(l.valorLiq),
    status: l.status,                // 'Pendente', 'Recebido', 'Pago', 'Cancelado', 'Parcial'
    obs: l.obs || null
  };
}
```

### fromRow() — banco → app
```javascript
function fromRow(r) {
  return {
    id: r.id, seq: r.seq || null,
    tipo: r.tipo,
    dataComp: r.data_comp || '',
    dataPgto: r.data_pgto || '',
    dataVenc: r.data_venc || '',         // ⚠️ coluna JÁ EXISTE no banco — falta mapear no código (item #3)
    cat: r.cat || '', sub: r.sub || '',
    desc: r.descricao || '', cc: r.cc || '',
    forma: r.forma || 'PIX', conta: r.conta || '',
    doc: r.doc || '',
    valorBruto: r.valor_bruto || 0,
    ded: r.ded || 0,
    valorLiq: r.valor_liq || 0,
    status: r.status || 'Pendente',
    obs: r.obs || ''
  };
}
```

---

## 🌐 Estado Global

```javascript
let DATA = [];               // Todos os lançamentos em memória
let CATS_DATA = {R:[], D:[]}; // Categorias carregadas do Supabase
const CATS = {R:{}, D:{}};   // Objeto computado: {catNome: [subNomes]}
let RECORRENTES_RECEITAS = [];
let RECORRENTES_DESPESAS = [];
let CONTAS = [];             // Nomes das contas bancárias
let TAB = 'dashboard';       // Aba ativa
let YEAR = new Date().getFullYear();
```

**Nunca recarregar a página para atualizar a UI.** Sempre:
1. Modificar `DATA` em memória
2. Chamar `buildNav()` para atualizar badges
3. Chamar `render()` ou `renderKeepScroll()` para re-renderizar

---

## 🔧 Funções Principais

### Banco de dados
```javascript
sbFetch(method, path, body)  // Fetch para Supabase REST API
dbLoad()                     // Carrega todos os lançamentos (paginado, 1000/página)
dbInsert(item)               // Insere lançamento
dbUpdate(item)               // Atualiza lançamento
dbDelete(id)                 // Exclui lançamento
```

### UI
```javascript
render()                     // Re-renderiza a aba atual
renderKeepScroll()           // Re-renderiza sem pular para o topo
buildNav()                   // Atualiza badges do sidebar
toast(msg, type)             // Notificação: type = 'ok' | 'err'
setSyncStatus(state, msg)    // Indicador de sync: state = 'loading' | 'ok' | 'err'
appIcon(name)                // Retorna SVG do ícone pelo nome
openEdit(id)                 // Abre modal de edição de lançamento
openForm()                   // Abre modal de novo lançamento
```

### Navegação
```javascript
const BASE_PATH = '/Skala-F/';
pushTab(id)                  // Navega para uma aba
tabFromPath()                // Detecta aba pela URL atual
```

### Utilitários
```javascript
newId()                      // Gera UUID v4
parseMoney(v)                // Converte string de valor para float
fmt(v)                       // Formata número para BRL (ex: 1.234,56)
dateBR(s)                    // Converte 'YYYY-MM-DD' para 'DD/MM/AAAA'
compDisplay(s)               // Converte 'YYYY-MM-01' para 'Jan/2026'
compFromView(s)              // Converte 'MM/AAAA' para 'YYYY-MM-01'
slugify(s)                   // Transforma string em slug (ex: 'Receita de Serviços' → 'receita_de_servicos')
esc(s)                       // Escapa HTML
```

---

## 🎨 Design System (CSS)

### Variáveis principais
```css
/* Paleta verde (brand) */
--brand: #137c3c
--brand-dark: #0b5a30
--brand-mid: #1a9d4d
--gold: #e3b341          /* Acento amarelo/dourado */

/* Superfícies */
--bg                     /* Background principal */
--s1                     /* Surface 1 (cards, modais) */
--s2                     /* Surface 2 (headers de tabela, inputs) */
--s3                     /* Surface 3 (hover states) */

/* Texto */
--tx                     /* Texto primário */
--tx2                    /* Texto secundário */
--tx3                    /* Texto terciário / placeholder */

/* Bordas */
--bd                     /* Borda padrão */
--bd2                    /* Borda secundária */

/* Feedback */
--teal                   /* Valores positivos / receitas */
--red                    /* Valores negativos / despesas / erros */
--blue                   /* Info / projeções */
--orange                 /* Alertas */

/* Elevação */
--shadow                 /* Sombra padrão de cards */
--shadow-sm              /* Sombra pequena */
```

### Referência visual
- **Estilo de referência:** Lovable (clean, moderno, refinado)
- **Gráficos:** linhas suaves (bezier) com gradiente, tooltips interativos, animação de entrada
- **Cards:** background `var(--s1)`, border `var(--bd)`, border-radius `12px`, shadow `var(--shadow)`
- **Card destaque:** gradient verde (`var(--brand-dark)` → `var(--brand)` → `var(--brand-mid)`), texto branco
- **Modais:** largura generosa, campos agrupados por seção, ações secundárias à esquerda / primárias à direita
- **Tabelas:** cabeçalho sticky, hover nas linhas, checkboxes customizados
- **Botão primário:** `.btn-pri` — gradient verde, texto branco
- **Botão secundário:** `.btn-ghost` — fundo branco, borda cinza
- **Sidebar:** gradient verde escuro, texto branco

### Classes CSS importantes
```css
.kpi              /* Cards de KPI no dashboard */
.kpi-grid .kpi:first-child  /* Card de destaque (fundo verde) */
.lr               /* Linha de tabela (lan-row) */
.dr               /* Linha de tabela do DRE/Fluxo */
.dr.tot           /* Linha de total (fundo verde suave) */
.dr.proj-row      /* Linha de projeção (itálico, azul) */
.tp               /* Badge de tipo: .r = receita, .d = despesa, .t = transferência */
.badge            /* Badge de status: .bg = verde, .by = amarelo, .br = vermelho */
.nv               /* Item do sidebar: .on = ativo */
.nb               /* Badge numérico do sidebar */
.btn-exp          /* Botões do sidebar (Exportar, Importar) */
.overlay          /* Fundo de modal */
.modal            /* Container do modal */
```

---

## 🔀 Navegação — Abas Disponíveis

```javascript
const TABS = [
  { id: 'dashboard',    lbl: 'Dashboard' },
  { id: 'receber',      lbl: 'Contas a Receber' },
  { id: 'pagar',        lbl: 'Contas a Pagar' },
  { id: 'dre',          lbl: 'Relatórios & DRE' },     // ⚠️ Renomear para 'DRE' (item #52)
  { id: 'fluxo',        lbl: 'Fluxo de Caixa' },
  { id: 'recorrentes',  lbl: 'Desp. Recorrentes' },
  { id: 'categorias',   lbl: 'Categorias' },
  { id: 'contas',       lbl: 'Contas' },
  { id: 'extrato',      lbl: 'Extrato' }
  // ⚠️ Adicionar: { id: 'clientes', lbl: 'Clientes' }  (Fase 3)
];
```

---

## 📥 Importadores

### Importar Faturamento (CSV/XLS do Domínio Honorários)
- **Função:** `onImpFatChange()` → `parseFaturamentoCSV()` / `parseFaturamentoXLS()`
- **Campos lidos do Domínio:** `codigo`, `nome`, `valorLiq`, `valorBruto`, `desconto`, `retencoes`, `vencimento`, `servicos`
- **⚠️ Bug atual:** `vencimento` do Domínio vai para `dataPgto` — errado. Deve ir para `data_venc` (item #4 do roadmap)
- **Regras de categoria automáticas:** array `CAT_RULES` no topo do arquivo

### Importar Recebimentos / Baixar por Relatório (XLSX do Domínio)
- **Função:** `openBaixarRelModal()` → `parseRelatorioXLSX()`
- **Mapeamento de colunas:** A(0)=código, C(2)=nome, F(5)=competência, J(9)=vencimento, R(17)=data recebimento, W(22)=descrição, AK(36)=valor recebido
- **⚠️ Regra:** ao dar baixa, atualizar APENAS `dataPgto` — nunca alterar `data_venc` (item #5)

---

## 🔐 Autenticação

```javascript
// Token armazenado em localStorage:
localStorage.getItem('sb_token')     // JWT de acesso
localStorage.getItem('sb_refresh')   // Token de refresh
localStorage.getItem('sb_expires')   // Timestamp de expiração

// Funções:
doLogin()       // Login com email/senha
doLogout()      // Logout + limpa sessão
startApp()      // Verifica sessão ao carregar, refresh automático se necessário
```

---

## ⚠️ Problemas Conhecidos / Dívida Técnica

1. ~~**Campo `data_venc` não mapeado no código**~~ ✅ **Concluído (itens #3 e #4).** `toRow()` usa `effectiveVenc(l)||null`, `fromRow()` faz mapeamento com fallback legacy, o formulário tem campo Vencimento entre Competência e Data Pagamento, as tabelas de Contas a Receber/Pagar exibem a coluna Vencimento, e o importador de faturamento já salva em `dataVenc` com `dataPgto:''`. **Pendente apenas o SQL de migração** para preencher `data_venc` retroativamente nos registros existentes (item #6 de filtros também pode ser revisado).

2. **`cc` é texto livre** — O campo `cc` (código do cliente) existe mas não é FK para nenhuma tabela. Será resolvido na Fase 3 (módulo de clientes).

3. **API key de IA no browser** — Quando implementar insights de IA, NUNCA colocar a API key da Anthropic no frontend. Usar Supabase Edge Function como proxy. Ver item #75 do roadmap.

4. **Campo `projection_rule` ausente nas categorias** — Necessário para a engine de projeção do Fluxo de Caixa (Fase 4, item #70).

5. ~~**Filtros usam `dataPgto` onde deveriam usar `data_venc`**~~ ✅ **Concluído (item #6).** Todos os cálculos de "atrasados" e os filtros de Vencimento já usam `effectiveVenc(l)`, que retorna `dataVenc` se preenchido, ou `dataPgto` como fallback legacy. Filtro de Data de Pagamento continua usando `dataPgto` corretamente.

---

## 🗺️ Roadmap — 77 itens em 5 Fases

Documentação completa no Notion: Skala 2.0 → Projetos → Gestão → Ações → "Criar dashboard p/ monitoramento automático KPIs"

### Resumo das fases:
- **Fase 1 (itens #1–6):** ~~Criar coluna `data_venc`~~ ✅ | ~~Mapear no código (#3)~~ ✅ | ~~Corrigir importador faturamento (#4)~~ ✅ | ~~SQL migração histórica~~ ✅ | ~~Corrigir importador baixa (#5)~~ ✅ | ~~Corrigir filtros (#6)~~ ✅
- **Fase 2 (itens #7–44):** Melhorias de UX nos modais, Contas a Receber, Dashboard, Sidebar
- **Fase 3 (itens #45–51):** Módulo de Clientes (nova tabela + UI + vinculação por IA)
- **Fase 4 (itens #52–74):** DRE, Fluxo de Caixa, engine de projeção
- **Fase 5 (itens #75–77):** Insights de IA (Edge Function + DRE + Fluxo de Caixa)

**Fase 1 CONCLUÍDA. Próximo: Fase 2 (melhorias de UX).**

---

## 📏 Convenções de Código

- **JavaScript:** ES6+, async/await, sem TypeScript, sem imports/exports (scripts carregados em ordem no HTML)
- **IDs:** sempre `crypto.randomUUID()` via `newId()`
- **Datas no banco:** `YYYY-MM-DD` para datas completas, `YYYY-MM-01` para competências mensais
- **Datas na UI:** `DD/MM/AAAA` para exibição, `MM/AAAA` para competência
- **Valores monetários:** float no banco, formatados com `fmt()` na UI, parseados com `parseMoney()`
- **Normalização de texto:** usar `_norm(s)` para comparações de texto (remove acentos, lowercase)
- **Slugs:** usar `slugify(s)` para chaves/identificadores de categorias
- **HTML inline:** construir com template literals, sempre escapar com `esc()` valores do usuário
- **Erros:** sempre `toast(msg, 'err')` para erros visíveis ao usuário + `console.error()` para debug
- **Sem recarregamento de página:** modificar DATA + render(), nunca `location.reload()`

---

## 🔄 Como Implementar um Item do Roadmap

Ao receber uma tarefa como "implemente o item #X":

1. **Ler este CLAUDE.md** para entender o contexto
2. **Identificar quais arquivos** serão modificados (geralmente 1–2 arquivos)
3. **Verificar dependências** — o item tem pré-requisitos não implementados?
4. **Se for migration de banco:** escrever o SQL completo com GRANT + RLS se criar tabela nova
5. **Se for UI:** seguir os padrões de design documentados acima
6. **Testar mentalmente** o fluxo antes de gerar o código
7. **Implementar de forma incremental** — um arquivo por vez, explicando cada mudança

---

## 🏷️ Regras de Negócio Importantes

- **Transferências:** sempre criam 2 lançamentos (D na conta origem + R na conta destino), vinculados pelo campo `doc` com prefixo `TRANSF#`
- **Juros:** ao salvar lançamento com juros > 0, cria automaticamente um segundo lançamento na categoria "Receitas Financeiras / Juros Multas"
- **Competência vs Pagamento:** `dataComp` = quando o serviço foi prestado (regime de competência); `dataPgto` = quando o dinheiro entrou/saiu (regime de caixa)
- **Vencimento:** coluna `data_venc` (date) já existe no banco. No código: campo `dataVenc` no objeto app. Representa a data em que o título vence, independente de quando foi pago.
- **Status:** Pendente → Recebido (receitas) / Pago (despesas) / Parcial / Cancelado
- **Paginação do banco:** `dbLoad()` busca em páginas de 1000 registros até trazer tudo
- **Categorias dinâmicas:** carregadas do Supabase, não hardcoded — sempre usar `CATS_DATA` e `CATS`

---

## 🔗 Integrações Externas

| Sistema | Papel | Integração |
|---|---|---|
| Domínio Honorários | Faturamento e gestão de clientes | Export CSV/XLS → importar no app |
| Supabase | Backend/banco de dados | REST API com JWT |
| Claude API (Anthropic) | Insights de IA (a implementar) | Via Edge Function (nunca direto do browser) |

---

*Última atualização deste arquivo: Mai/2026*
*Para atualizar: editar diretamente no repositório ou pedir ao Claude para revisar*
