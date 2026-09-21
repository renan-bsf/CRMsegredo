import { ShieldCheck, LockKeyhole, Database, UserRound } from "lucide-react";
import { requireActor } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { PageHeading, Empty } from "@/components/common";
import { MemberEditor } from "@/components/forms";
const labels: Record<string, string> = {
  CUSTOMER_CREATED: "Cliente cadastrado",
  CUSTOMER_UPDATED: "Perfil atualizado",
  CUSTOMER_PROFILE_VIEWED: "Perfil consultado",
  CUSTOMER_ARCHIVED: "Cliente arquivado",
  VARIANT_CREATED: "Variação cadastrada",
  VARIANT_UPDATED: "Variação atualizada",
  STOCK_RECEIVED: "Estoque recebido",
  STOCK_ADJUSTED: "Estoque ajustado",
  SALE_CREATED: "Venda registrada",
  SALE_CANCELLED: "Venda cancelada",
  SALE_PAID: "Recebimento confirmado",
  EXPENSE_CREATED: "Despesa registrada",
  EXPENSE_VOIDED: "Despesa anulada",
  MEMBER_UPDATED: "Permissão alterada",
};
export default async function SettingsPage() {
  const actor = await requireActor("manage");
  const members = actor.demo
    ? [{ id: actor.id, name: actor.name, role: actor.role, active: true }]
    : await db().member.findMany({
        select: { id: true, name: true, role: true, active: true },
        orderBy: { name: "asc" },
      });
  const events = actor.demo
    ? []
    : await db().auditEvent.findMany({
        select: { id: true, action: true, createdAt: true, member: { select: { name: true } } },
        take: 50,
        orderBy: { createdAt: "desc" },
      });
  return (
    <>
      <PageHeading
        eyebrow="CONTROLE E CONFIANÇA"
        title="Configurações"
        description="Acompanhe acessos e a trilha de atividades."
      />
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        {[
          {
            icon: ShieldCheck,
            title: "Acesso em duas etapas",
            text: actor.demo ? "Simulado na demonstração" : "Obrigatório para todos os usuários",
          },
          {
            icon: LockKeyhole,
            title: "Dados íntimos protegidos",
            text: "Contatos e preferências com criptografia",
          },
          {
            icon: Database,
            title: "Ambiente exclusivo",
            text: actor.demo ? "Dados fictícios · somente leitura" : "Banco privado desta operação",
          },
        ].map((s) => (
          <div key={s.title} className="panel p-6">
            <s.icon className="mb-4 text-primary" size={23} />
            <h2 className="text-sm font-semibold">{s.title}</h2>
            <p className="mt-2 text-xs text-muted-foreground">{s.text}</p>
          </div>
        ))}
      </div>
      <section className="panel mb-6">
        <div className="panel-heading">
          <div>
            <h2>Equipe autorizada</h2>
            <p>Novos usuários precisam ser provisionados pelo responsável pela instalação</p>
          </div>
          <UserRound size={19} />
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Perfil</th>
                <th>Situação</th>
                <th>Permissões</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td>{m.name}</td>
                  <td>{m.role === "ADMIN" ? "Sócio administrador" : "Operador"}</td>
                  <td>
                    <span className={`badge ${m.active ? "badge-green" : "badge-red"}`}>
                      {m.active ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td>
                    <MemberEditor {...m} self={actor.id === m.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t px-6 py-4 text-xs leading-relaxed text-muted-foreground">
          Operadores podem consultar estoque, atender clientes e registrar vendas. Custos,
          resultados, despesas, cancelamentos e configurações são exclusivos dos sócios.
        </p>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Atividades recentes</h2>
            <p>Últimos 50 eventos · conteúdo dos perfis e credenciais não entram neste histórico</p>
          </div>
        </div>
        {events.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Usuário</th>
                  <th>Atividade</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id}>
                    <td className="text-muted-foreground">
                      {e.createdAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                    </td>
                    <td>{e.member.name}</td>
                    <td>{labels[e.action] ?? e.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Nenhuma atividade registrada"
            description={
              actor.demo
                ? "Eventos de acesso reais aparecem após conectar o Supabase."
                : "Os primeiros registros aparecerão após uma operação."
            }
          />
        )}
      </section>
    </>
  );
}
