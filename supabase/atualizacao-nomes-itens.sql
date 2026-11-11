-- =====================================================================
-- Checklist Brigada — itens com nome positivo ("Localização adequada")
-- Rode UMA vez em: Supabase › SQL Editor › New query › cole tudo › Run.
-- Pode rodar de novo sem problema: o que já foi trocado não muda.
--
-- O app agora escreve cada item como o equipamento DEVE estar, para que
-- "Conforme" faça sentido. Este script troca os nomes antigos nos checklists
-- já gravados (detalhe, itens não conformes e fotos). As respostas não mudam:
-- "Conforme" sempre quis dizer que o item estava ok.
-- =====================================================================
do $$
declare
  m record;
begin
  for m in select * from (values
    ('Localização inadequada',  'Localização adequada'),
    ('Acesso obstruído',        'Acesso livre'),
    ('Sem suporte',             'Com suporte'),
    ('Pressão anormal',         'Pressão normal'),
    ('Vencido',                 'Dentro da validade'),
    ('Despressurizado',         'Pressurizado'),
    ('Não possui - Reinstalar', 'Extintor no local'),
    ('Vazamento',               'Sem vazamento')
  ) as t(antigo, novo) loop
    -- No detalhe o nome é chave do JSON ("nome":). A troca é feita no texto para manter a ordem dos itens.
    -- Em itens_nc o formato é "Item (observação); Item (observação)".
    update public.registros
       set detalhe  = replace(detalhe, '"' || m.antigo || '":', '"' || m.novo || '":'),
           itens_nc = regexp_replace(itens_nc, '(^|; )' || m.antigo || ' \(', '\1' || m.novo || ' (', 'g')
     where strpos(detalhe, '"' || m.antigo || '":') > 0
        or itens_nc ~ ('(^|; )' || m.antigo || ' \(');
    update public.fotos set item = m.novo where item = m.antigo;
  end loop;
end $$;

-- Conferência: "com_nome_antigo" deve dar 0.
select count(*) as checklists,
       count(*) filter (where detalhe ~ '"(Localização inadequada|Acesso obstruído|Sem suporte|Pressão anormal|Vencido|Despressurizado|Não possui - Reinstalar|Vazamento)":') as com_nome_antigo
from public.registros;
