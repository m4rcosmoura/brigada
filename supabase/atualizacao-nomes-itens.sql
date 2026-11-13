-- =====================================================================
-- Checklist Brigada — itens com nome positivo ("Localização adequada")
-- Rode em: Supabase › SQL Editor › New query › cole tudo › Run.
-- Pode rodar de novo sem problema: o que já foi trocado não muda.
--
-- O app agora escreve cada item como o equipamento DEVE estar, para que
-- "Conforme" faça sentido. Este script:
--   1. troca os nomes antigos nos checklists já gravados (detalhe, itens não conformes e fotos);
--   2. cria um gatilho que faz a mesma troca em todo checklist que chegar depois,
--      caso algum celular ainda esteja com a versão antiga do app aberta.
-- As respostas não mudam: "Conforme" sempre quis dizer que o item estava ok.
-- =====================================================================

-- Nomes antigos → novos
create or replace function _mapa_itens() returns table (antigo text, novo text)
language sql immutable as $$
  values
    ('Localização inadequada',  'Localização adequada'),
    ('Acesso obstruído',        'Acesso livre'),
    ('Sem suporte',             'Com suporte'),
    ('Pressão anormal',         'Pressão normal'),
    ('Vencido',                 'Dentro da validade'),
    ('Despressurizado',         'Pressurizado'),
    ('Não possui - Reinstalar', 'Extintor no local'),
    ('Vazamento',               'Sem vazamento')
$$;

-- No detalhe o nome é chave do JSON ("nome":); a troca é no texto para manter a ordem dos itens.
-- Em itens_nc o formato é "Item (observação); Item (observação)".
create or replace function _renomear_itens_registro() returns trigger
language plpgsql set search_path = public as $$
declare m record;
begin
  for m in select * from _mapa_itens() loop
    new.detalhe  := replace(new.detalhe, '"' || m.antigo || '":', '"' || m.novo || '":');
    new.itens_nc := regexp_replace(new.itens_nc, '(^|; )' || m.antigo || ' \(', '\1' || m.novo || ' (', 'g');
  end loop;
  return new;
end $$;

create or replace function _renomear_item_foto() returns trigger
language plpgsql set search_path = public as $$
begin
  new.item := coalesce((select novo from _mapa_itens() where antigo = new.item), new.item);
  return new;
end $$;

drop trigger if exists renomear_itens on registros;
create trigger renomear_itens before insert or update on registros
  for each row execute function _renomear_itens_registro();
drop trigger if exists renomear_item on fotos;
create trigger renomear_item before insert on fotos
  for each row execute function _renomear_item_foto();

revoke all on function _mapa_itens(), _renomear_itens_registro(), _renomear_item_foto() from public, anon, authenticated;

-- Checklists já gravados: o gatilho faz a troca ao regravar a linha
update public.registros set detalhe = detalhe
 where detalhe ~ '"(Localização inadequada|Acesso obstruído|Sem suporte|Pressão anormal|Vencido|Despressurizado|Não possui - Reinstalar|Vazamento)":'
    or itens_nc ~ '(^|; )(Localização inadequada|Acesso obstruído|Sem suporte|Pressão anormal|Vencido|Despressurizado|Não possui - Reinstalar|Vazamento) \(';
update public.fotos f set item = m.novo from _mapa_itens() m where f.item = m.antigo;

-- Conferência: "com_nome_antigo" deve dar 0.
select count(*) as checklists,
       count(*) filter (where detalhe ~ '"(Localização inadequada|Acesso obstruído|Sem suporte|Pressão anormal|Vencido|Despressurizado|Não possui - Reinstalar|Vazamento)":') as com_nome_antigo
from public.registros;
