-- =====================================================================
-- Checklist Brigada — estrutura do banco no Supabase (Postgres)
-- Rode este arquivo inteiro UMA vez em: Supabase › SQL Editor › New query › Run.
-- Pode rodar de novo sem perder dados (tudo é "if not exists" / "or replace").
--
-- Segurança:
--  * As tabelas ficam fechadas (RLS ligado, sem políticas): o app não lê nem grava nelas direto.
--  * O app LÊ pelas visões v_* (que não mostram o código secreto do QR).
--  * O app GRAVA só pelas funções abaixo:
--      registrar()          → confere o código secreto do QR (prova de que leu a etiqueta no local)
--      funções de gestão    → conferem o PIN da coordenação
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- tabelas ----------
create table if not exists brigadistas (
  nome   text primary key,
  setor  text not null default '',      -- setor de trabalho (ex.: PRODUÇÃO)
  dupla  text not null default '',
  ativo  boolean not null default true
);

create table if not exists setores (
  setor  text primary key,              -- = Localização do equipamento
  dupla  text not null default ''
);

create table if not exists equipamentos (
  codigo     text primary key,
  categoria  text not null,
  tipo       text not null default '',
  local      text not null,             -- Localização (é o setor)
  grupo      text not null default '',
  ativo      boolean not null default true,
  token      text not null default upper(encode(gen_random_bytes(5), 'hex'))  -- código secreto do QR
);

create table if not exists registros (
  id          text primary key,
  data_hora   timestamptz not null,
  mes         text not null,
  codigo      text not null references equipamentos(codigo),
  categoria   text, tipo text, local text, setor text, dupla text,
  brigadista  text not null,
  resultado   text not null check (resultado in ('OK', 'NC')),
  itens_nc    text not null default '',
  observacao  text not null default '',
  detalhe     text not null default '',
  gravado_em  timestamptz not null default now()
);
create index if not exists registros_mes_idx on registros (mes);

create table if not exists config (
  chave  text primary key,
  valor  text not null
);

alter table brigadistas  enable row level security;
alter table setores      enable row level security;
alter table equipamentos enable row level security;
alter table registros    enable row level security;
alter table config       enable row level security;

-- ---------- leitura pública (sem o código secreto) ----------
create or replace view v_brigadistas as
  select nome as "Nome", setor as "Setor", dupla as "Dupla",
         case when ativo then 'SIM' else 'NÃO' end as "Ativo"
  from brigadistas;

create or replace view v_setores as
  select setor as "Setor", dupla as "Dupla" from setores;

create or replace view v_equipamentos as
  select codigo as "Codigo", categoria as "Categoria", tipo as "Tipo", local as "Local", grupo as "Grupo",
         case when ativo then 'SIM' else 'NÃO' end as "Ativo"
  from equipamentos;

create or replace view v_registros as
  select id as "Id",
         to_char(data_hora at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "DataHora",
         mes as "Mes", codigo as "Codigo", categoria as "Categoria", tipo as "Tipo", local as "Local",
         setor as "Setor", dupla as "Dupla", brigadista as "Brigadista", resultado as "Resultado",
         itens_nc as "ItensNC", observacao as "Observacao", detalhe as "Detalhe"
  from registros
  where data_hora > now() - interval '13 months';

grant select on v_brigadistas, v_setores, v_equipamentos, v_registros to anon, authenticated;

-- ---------- PIN da coordenação ----------
create or replace function _pin_ok(p_pin text) returns boolean
language sql security definer set search_path = public, extensions as $$
  select exists (select 1 from config where chave = 'pin_hash' and valor = crypt(coalesce(p_pin, ''), valor));
$$;

create or replace function _exigir_pin(p_pin text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not _pin_ok(p_pin) then raise exception 'PIN de administrador incorreto'; end if;
end $$;

-- Só pelo SQL Editor:  select definir_pin('SEU-PIN');
create or replace function definir_pin(p_novo text) returns text
language plpgsql security definer set search_path = public, extensions as $$
begin
  if length(coalesce(p_novo, '')) < 4 then raise exception 'Use um PIN com pelo menos 4 caracteres'; end if;
  insert into config (chave, valor) values ('pin_hash', crypt(p_novo, gen_salt('bf')))
    on conflict (chave) do update set valor = excluded.valor;
  return 'PIN definido';
end $$;

-- ---------- funções chamadas pelo app ----------

-- Grava checklists. Só aceita o que vier com o código secreto certo do QR.
create or replace function registrar(registros jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  r jsonb;
  aceitos text[] := '{}';
  rejeitados text[] := '{}';
  v_token text;
begin
  for r in select * from jsonb_array_elements(registrar.registros) loop
    if r->>'Id' is null then continue; end if;
    if exists (select 1 from public.registros x where x.id = r->>'Id') then
      aceitos := aceitos || (r->>'Id');          -- reenvio de algo já gravado
      continue;
    end if;
    select token into v_token from equipamentos where upper(codigo) = upper(r->>'Codigo');
    if v_token is null or v_token <> coalesce(r->>'Token', '') then
      rejeitados := rejeitados || (r->>'Id');
      continue;
    end if;
    insert into public.registros (id, data_hora, mes, codigo, categoria, tipo, local, setor, dupla,
                                  brigadista, resultado, itens_nc, observacao, detalhe)
    values (r->>'Id', (r->>'DataHora')::timestamptz,
            coalesce(r->>'Mes', to_char((r->>'DataHora')::timestamptz at time zone 'America/Sao_Paulo', 'YYYY-MM')),
            (select codigo from equipamentos where upper(codigo) = upper(r->>'Codigo')),
            r->>'Categoria', r->>'Tipo', r->>'Local', r->>'Setor', r->>'Dupla',
            r->>'Brigadista', r->>'Resultado', coalesce(r->>'ItensNC', ''), coalesce(r->>'Observacao', ''),
            coalesce(r->>'Detalhe', ''));
    aceitos := aceitos || (r->>'Id');
  end loop;
  return jsonb_build_object('ok', true, 'ids', to_jsonb(aceitos), 'rejeitados', to_jsonb(rejeitados));
end $$;

-- Confere o PIN (entrada da gestão)
create or replace function admin_pin(pin text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform _exigir_pin(pin);
  return jsonb_build_object('ok', true);
end $$;

-- Define a dupla de um ou vários setores (localizações)
create or replace function definir_setor_dupla(pin text, setores text[], dupla text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare s text;
begin
  perform _exigir_pin(pin);
  foreach s in array setores loop
    insert into public.setores (setor, dupla) values (trim(s), coalesce(definir_setor_dupla.dupla, ''))
      on conflict on constraint setores_pkey do update set dupla = excluded.dupla;
  end loop;
  return jsonb_build_object('ok', true, 'alterados', coalesce(array_length(setores, 1), 0));
end $$;

-- Cria ou altera um brigadista (só os campos enviados mudam)
create or replace function salvar_brigadista(pin text, nome text, setor text default null, dupla text default null, ativo text default null)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v_nome text := upper(trim(salvar_brigadista.nome));
begin
  perform _exigir_pin(salvar_brigadista.pin);
  if v_nome is null or v_nome = '' then raise exception 'Nome vazio'; end if;
  insert into brigadistas (nome, setor, dupla, ativo)
    values (v_nome, coalesce(salvar_brigadista.setor, ''), coalesce(salvar_brigadista.dupla, ''),
            coalesce(upper(salvar_brigadista.ativo) not in ('NÃO', 'NAO', 'N', 'FALSE'), true))
  on conflict on constraint brigadistas_pkey do update set
    setor = coalesce(salvar_brigadista.setor, brigadistas.setor),
    dupla = coalesce(salvar_brigadista.dupla, brigadistas.dupla),
    ativo = case when salvar_brigadista.ativo is null then brigadistas.ativo
                 else upper(salvar_brigadista.ativo) not in ('NÃO', 'NAO', 'N', 'FALSE') end;
  return jsonb_build_object('ok', true);
end $$;

-- Códigos secretos para imprimir as etiquetas (só com PIN)
create or replace function tokens(pin text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform _exigir_pin(pin);
  return jsonb_build_object('ok', true, 'tokens', coalesce((select jsonb_object_agg(upper(codigo), token) from equipamentos), '{}'::jsonb));
end $$;

-- Troca o código de um equipamento: a etiqueta antiga deixa de valer
create or replace function novo_token(pin text, codigo text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare t text := upper(encode(gen_random_bytes(5), 'hex'));
begin
  perform _exigir_pin(pin);
  update equipamentos set token = t where upper(equipamentos.codigo) = upper(novo_token.codigo);
  if not found then raise exception 'Equipamento não encontrado'; end if;
  return jsonb_build_object('ok', true, 'token', t);
end $$;

-- quem pode chamar o quê
revoke all on function _pin_ok(text), _exigir_pin(text), definir_pin(text) from public, anon, authenticated;
revoke all on function registrar(jsonb), admin_pin(text), definir_setor_dupla(text, text[], text),
  salvar_brigadista(text, text, text, text, text), tokens(text), novo_token(text, text) from public;

-- Por último, defina o PIN da coordenação (troque 'SEU-PIN'):
--   select definir_pin('SEU-PIN');
grant execute on function registrar(jsonb), admin_pin(text), definir_setor_dupla(text, text[], text),
  salvar_brigadista(text, text, text, text, text), tokens(text), novo_token(text, text) to anon, authenticated;
