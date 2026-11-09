-- =====================================================================
-- Checklist Brigada — ATUALIZAÇÃO: fotos nos itens "Não conforme"
-- Rode UMA vez no Supabase › SQL Editor › New query › Run.
-- Pode rodar de novo sem perder dados. (Já está incluído no schema.sql para instalações novas.)
-- =====================================================================

-- Fotos ficam numa tabela à parte: o painel continua leve e a gestão só baixa quando abre o checklist.
create table if not exists fotos (
  id           bigserial primary key,
  registro_id  text not null references registros(id) on delete cascade,
  item         text not null default '',
  imagem       text not null,                 -- data:image/jpeg;base64,... (reduzida no celular)
  criado_em    timestamptz not null default now()
);
create index if not exists fotos_registro_idx on fotos (registro_id);
alter table fotos enable row level security;  -- fechada: só as funções abaixo leem/gravam

-- Grava checklists (e suas fotos). Só aceita o que vier com o código secreto certo do QR.
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
    -- fotos: no máximo 15 por checklist, só imagens, até ~500 KB cada
    if jsonb_typeof(r->'Fotos') = 'array' then
      insert into fotos (registro_id, item, imagem)
      select r->>'Id', coalesce(f->>'item', ''), f->>'imagem'
      from jsonb_array_elements(r->'Fotos') with ordinality as t(f, n)
      where n <= 15 and (f->>'imagem') like 'data:image/%' and length(f->>'imagem') <= 700000;
    end if;
    aceitos := aceitos || (r->>'Id');
  end loop;
  return jsonb_build_object('ok', true, 'ids', to_jsonb(aceitos), 'rejeitados', to_jsonb(rejeitados));
end $$;

-- Fotos de um checklist (gestão, com PIN)
create or replace function fotos_do_registro(pin text, registro text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform _exigir_pin(pin);
  return jsonb_build_object('ok', true, 'fotos', coalesce((
    select jsonb_agg(jsonb_build_object('item', item, 'imagem', imagem) order by id)
    from fotos where registro_id = fotos_do_registro.registro), '[]'::jsonb));
end $$;

revoke all on function registrar(jsonb), fotos_do_registro(text, text) from public;
grant execute on function registrar(jsonb), fotos_do_registro(text, text) to anon, authenticated;

select 'Atualização de fotos aplicada' as resultado;
