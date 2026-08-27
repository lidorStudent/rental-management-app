import { currentIsoDateInUtc } from "@/lib/dates/currentDate";
import { formatCentsAsCurrency } from "@/lib/money/formatCentsAsCurrency";
import { buildRentSchedule } from "@/lib/rent/buildRentSchedule";
import type { StatementRange } from "@/lib/rent/statementPeriodRange";
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";

const PAYMENT_METHOD_WORDS: Record<string, string> = {
  bank_transfer: "Bank transfer",
  cash: "Cash",
  cheque: "Cheque",
  card: "Card",
  other: "Other",
};

/**
 * A rent statement, as a page the browser prints.
 *
 * There is no PDF library in this project. The browser already lays this out and paginates it, and
 * printing it produces exactly the document on screen; a second rendering path would be a second
 * layout to keep in step with this one.
 *
 * Everything here is read from the ledger. The charges come from the lease's own schedule, derived
 * as it is everywhere else, and the payments are the rows themselves rather than any total stored
 * anywhere, because a statement that cannot be checked against its own lines is not a statement.
 *
 * The query names a lease but carries no owner filter. Row Level Security decides whether this
 * reader may see it: a landlord for their own, a tenant for the one they are the tenant of, nobody
 * for anything else.
 */
export async function RentStatement({
  leaseId,
  range,
}: {
  leaseId: string;
  range: StatementRange;
}) {
  const supabaseClient = await createSupabaseServerClient();

  // The lease and its payments are independent once the lease id and the range are known, so they go
  // together. Both are answered as the signed-in reader, so a lease that is not theirs returns no
  // rows from either and the component renders nothing.
  const [{ data: lease }, { data: payments }] = await Promise.all([
    supabaseClient
      .from("leases")
      .select(
        "id, start_date, end_date, rent_amount_cents, deposit_amount_cents, rent_due_day, units(label, properties(name, address_line, city, postal_code)), tenant:profiles!leases_tenant_profile_id_fkey(full_name, email), landlord:profiles!leases_landlord_id_fkey(full_name, email)",
      )
      .eq("id", leaseId)
      .maybeSingle(),
    supabaseClient
      .from("rent_payments")
      .select("id, period_month, amount_cents, received_on, method, reference")
      .eq("lease_id", leaseId)
      .gte("period_month", range.fromMonth)
      .lte("period_month", range.toMonth)
      .order("received_on", { ascending: true }),
  ]);

  if (lease === null) {
    return null;
  }

  const periodsInRange = buildRentSchedule({
    startDate: lease.start_date,
    endDate: lease.end_date,
    rentAmountInAgorot: lease.rent_amount_cents,
    rentDueDay: lease.rent_due_day,
  }).filter(
    (period) => period.periodMonth >= range.fromMonth && period.periodMonth <= range.toMonth,
  );

  const paymentRows = payments ?? [];
  const charged = periodsInRange.reduce((total, period) => total + period.amountDueInAgorot, 0);
  const received = paymentRows.reduce((total, payment) => total + payment.amount_cents, 0);
  const balance = charged - received;
  const paidByPeriod = totalPaidByPeriod(paymentRows);

  return (
    <article className="space-y-6 text-sm">
      <StatementHeader
        unitLabel={lease.units.label}
        propertyName={lease.units.properties.name}
        address={joinAddress([
          lease.units.properties.address_line,
          lease.units.properties.city,
          lease.units.properties.postal_code,
        ])}
        range={range}
      />

      <StatementParties tenant={lease.tenant} landlord={lease.landlord} />

      <LeaseTermsSection
        startDate={lease.start_date}
        endDate={lease.end_date}
        rentAmountInAgorot={lease.rent_amount_cents}
        depositAmountInAgorot={lease.deposit_amount_cents}
        rentDueDay={lease.rent_due_day}
      />

      <ChargesTable periods={periodsInRange} paidByPeriod={paidByPeriod} />

      <PaymentsTable payments={paymentRows} />

      <StatementSummary charged={charged} received={received} balance={balance} />

      <footer className="text-muted-foreground border-t pt-4 text-xs">
        <p>
          Produced from the payment ledger held by the landlord. Rent is recorded here as received;
          it is not collected through this application. Payments are listed against the month they
          settle, which may differ from the day they arrived.
        </p>
      </footer>
    </article>
  );
}

type Party = { full_name: string; email: string } | null;

/** Who this statement is between. Either side can be missing only before a tenant account exists. */
function StatementParties({ tenant, landlord }: { tenant: Party; landlord: Party }) {
  return (
    <section className="grid gap-6 break-inside-avoid sm:grid-cols-2">
      <Panel title="Tenant">
        <Line label="Name" value={tenant?.full_name ?? "No tenant account"} />
        <Line label="Email" value={tenant?.email ?? ""} />
      </Panel>
      <Panel title="Landlord">
        <Line label="Name" value={landlord?.full_name ?? ""} />
        <Line label="Email" value={landlord?.email ?? ""} />
      </Panel>
    </section>
  );
}

function joinAddress(parts: readonly (string | null)[]): string {
  return parts.filter((part) => part !== null && part !== "").join(", ");
}

/** What arrived for each month, from the payment rows themselves rather than from any total. */
function totalPaidByPeriod(
  payments: readonly { period_month: string; amount_cents: number }[],
): ReadonlyMap<string, number> {
  const paidByPeriod = new Map<string, number>();

  for (const payment of payments) {
    const alreadyCounted = paidByPeriod.get(payment.period_month) ?? 0;
    paidByPeriod.set(payment.period_month, alreadyCounted + payment.amount_cents);
  }

  return paidByPeriod;
}

function StatementHeader({
  unitLabel,
  propertyName,
  address,
  range,
}: {
  unitLabel: string;
  propertyName: string;
  address: string;
  range: StatementRange;
}) {
  return (
    <header className="space-y-1 border-b pb-4">
      <h1 className="page-title">Rent statement</h1>
      <p>
        {unitLabel}, {propertyName}
      </p>
      <p className="text-muted-foreground">{address}</p>
      <p className="text-muted-foreground">
        Covering {range.fromMonth.slice(0, 7)} to {range.toMonth.slice(0, 7)}. Produced on{" "}
        {currentIsoDateInUtc()}.
      </p>
    </header>
  );
}

function LeaseTermsSection({
  startDate,
  endDate,
  rentAmountInAgorot,
  depositAmountInAgorot,
  rentDueDay,
}: {
  startDate: string;
  endDate: string;
  rentAmountInAgorot: number;
  depositAmountInAgorot: number;
  rentDueDay: number;
}) {
  return (
    <section className="break-inside-avoid space-y-2">
      <h2 className="section-title">Lease terms</h2>
      <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
        <Line label="Runs from" value={startDate} />
        <Line label="Until, inclusive" value={endDate} />
        <Line label="Monthly rent" value={formatCentsAsCurrency(rentAmountInAgorot)} />
        <Line label="Rent due" value={`Day ${rentDueDay} of each month`} />
        <Line
          label="Deposit"
          value={
            depositAmountInAgorot === 0
              ? "None recorded"
              : formatCentsAsCurrency(depositAmountInAgorot)
          }
        />
      </dl>
    </section>
  );
}

function ChargesTable({
  periods,
  paidByPeriod,
}: {
  periods: readonly { periodMonth: string; dueDate: string; amountDueInAgorot: number }[];
  paidByPeriod: ReadonlyMap<string, number>;
}) {
  return (
    <section className="space-y-2">
      <h2 className="section-title">Rent charged</h2>
      {periods.length === 0 ? (
        <p className="text-muted-foreground">No rent periods fall in this range.</p>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b text-left">
              <th className="py-1.5 text-xs font-semibold text-muted-foreground">Month</th>
              <th className="py-1.5 text-xs font-semibold text-muted-foreground">Due</th>
              <th className="py-1.5 text-right text-xs font-semibold text-muted-foreground">
                Charged
              </th>
              <th className="py-1.5 text-right text-xs font-semibold text-muted-foreground">
                Received
              </th>
            </tr>
          </thead>
          <tbody>
            {periods.map((period) => (
              <tr key={period.periodMonth} className="break-inside-avoid border-b">
                <td className="py-1.5">{period.periodMonth.slice(0, 7)}</td>
                <td className="py-1.5">{period.dueDate}</td>
                <td className="py-1.5 text-right tabular-nums">
                  {formatCentsAsCurrency(period.amountDueInAgorot)}
                </td>
                <td className="py-1.5 text-right tabular-nums">
                  {formatCentsAsCurrency(paidByPeriod.get(period.periodMonth) ?? 0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function PaymentsTable({
  payments,
}: {
  payments: readonly {
    id: string;
    period_month: string;
    amount_cents: number;
    received_on: string;
    method: string;
    reference: string | null;
  }[];
}) {
  return (
    <section className="space-y-2">
      <h2 className="section-title">Payments received</h2>
      {payments.length === 0 ? (
        <p className="text-muted-foreground">
          No payments were recorded against the months in this range.
        </p>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b text-left">
              <th className="py-1.5 text-xs font-semibold text-muted-foreground">Received on</th>
              <th className="py-1.5 text-xs font-semibold text-muted-foreground">
                For the month of
              </th>
              <th className="py-1.5 text-xs font-semibold text-muted-foreground">How</th>
              <th className="py-1.5 text-xs font-semibold text-muted-foreground">Reference</th>
              <th className="py-1.5 text-right text-xs font-semibold text-muted-foreground">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => (
              <tr key={payment.id} className="break-inside-avoid border-b">
                <td className="py-1.5">{payment.received_on}</td>
                <td className="py-1.5">{payment.period_month.slice(0, 7)}</td>
                <td className="py-1.5">{PAYMENT_METHOD_WORDS[payment.method] ?? payment.method}</td>
                <td className="py-1.5">{payment.reference ?? ""}</td>
                <td className="py-1.5 text-right tabular-nums">
                  {formatCentsAsCurrency(payment.amount_cents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function StatementSummary({
  charged,
  received,
  balance,
}: {
  charged: number;
  received: number;
  balance: number;
}) {
  return (
    <section className="break-inside-avoid space-y-1 border-t pt-4">
      <h2 className="section-title">Summary for this range</h2>
      <dl className="space-y-1">
        <Line label="Total charged" value={formatCentsAsCurrency(charged)} />
        <Line label="Total received" value={formatCentsAsCurrency(received)} />
        <Line
          label={balance < 0 ? "In credit" : "Outstanding"}
          value={formatCentsAsCurrency(Math.abs(balance))}
          isEmphasised
        />
      </dl>
    </section>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <h2 className="section-title">{title}</h2>
      <dl className="space-y-1">{children}</dl>
    </div>
  );
}

function Line({
  label,
  value,
  isEmphasised = false,
}: {
  label: string;
  value: string;
  isEmphasised?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={isEmphasised ? "font-semibold tabular-nums" : "tabular-nums"}>{value}</dd>
    </div>
  );
}
