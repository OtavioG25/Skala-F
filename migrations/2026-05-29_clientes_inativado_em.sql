alter table public.clientes
  add column if not exists inativado_em date;

comment on column public.clientes.recorrente_desde is
  'Data de inicio do relacionamento recorrente com o cliente.';

comment on column public.clientes.inativado_em is
  'Data em que o cliente recorrente foi inativado/churn.';
