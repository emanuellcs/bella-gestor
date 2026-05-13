import { AppRole } from "@/types";
import type { SupabaseTableName } from "@/types/db";

export type TestRow = Record<string, unknown>;
export type TestSeedRow = object;
export type TestDb = Partial<Record<SupabaseTableName, TestSeedRow[]>>;
export type MockMode = "admin" | "authenticated";

export interface MockUser {
  id: string;
  role: AppRole;
}

export interface MockSupabaseOptions {
  mode?: MockMode;
  user?: MockUser;
  tables?: TestDb;
  rpc?: Record<string, (args: TestRow, client: MockSupabaseClient) => unknown>;
}

export interface QueryResult<T = unknown> {
  data: T | null;
  error: { message: string; code?: string; status?: number } | null;
}

type Operator = "eq" | "neq" | "is" | "gte" | "lte" | "ilike" | "in" | "or";
type Mutation = "select" | "insert" | "update" | "upsert" | "delete";

interface Filter {
  operator: Operator;
  column: string;
  value: unknown;
}

const allTables: SupabaseTableName[] = [
  "app_options",
  "app_settings",
  "appointment_services",
  "appointments",
  "clients",
  "payments",
  "ping",
  "professionals",
  "sale_items",
  "sales",
  "service_variants",
  "services",
  "user_roles",
];

function cloneRow<T>(row: T): T {
  return structuredClone(row);
}

function numeric(value: unknown) {
  return typeof value === "number" ? value : Number(value);
}

function lower(value: unknown) {
  return String(value ?? "").toLowerCase();
}

function isNonProfessional(role: AppRole | undefined) {
  return role === AppRole.ADMIN || role === AppRole.SECRETARY;
}

function makeDenied(table: SupabaseTableName, action: Mutation): QueryResult {
  return {
    data: null,
    error: {
      code: "42501",
      status: 403,
      message: `RLS denied ${action} on ${table}`,
    },
  };
}

function ensureRows(tables: TestDb, table: SupabaseTableName) {
  tables[table] ??= [];
  return tables[table] as TestRow[];
}

function nextId(rows: TestRow[]) {
  const max = rows.reduce((highest, row) => {
    const value = numeric(row.id);
    return Number.isFinite(value) ? Math.max(highest, value) : highest;
  }, 0);
  return max + 1;
}

function rlsAllows(
  client: MockSupabaseClient,
  table: SupabaseTableName,
  action: Mutation,
  row?: TestRow,
  payload?: TestRow,
) {
  if (client.mode === "admin") return true;
  const role = client.user?.role;
  const userId = client.user?.id;
  if (!role || !userId) return false;

  if (action === "delete") return role === AppRole.ADMIN;

  if (table === "app_options" || table === "app_settings") return true;
  if (table === "ping") return false;

  if (table === "professionals") return action === "select";
  if (table === "services" || table === "service_variants") {
    if (action === "select") return true;
    return isNonProfessional(role);
  }
  if (table === "clients") {
    if (action === "select") return true;
    return isNonProfessional(role);
  }
  if (table === "appointments") {
    if (isNonProfessional(role)) return true;
    const owner = String(row?.professional_id ?? payload?.professional_id ?? "");
    return role === AppRole.PROFESSIONAL && owner === userId;
  }
  if (table === "appointment_services") {
    if (isNonProfessional(role)) return true;
    if (action !== "select") return false;
    const appointmentId = row?.appointment_id;
    const appointment = ensureRows(client.tables, "appointments").find(
      (item) => item.id === appointmentId,
    );
    return appointment?.professional_id === userId;
  }
  if (table === "payments" || table === "sales" || table === "sale_items") {
    return isNonProfessional(role);
  }
  if (table === "user_roles") {
    if (action === "select") {
      return role === AppRole.ADMIN || row?.user_id === userId;
    }
    return role === AppRole.ADMIN;
  }

  return false;
}

function matchesFilter(row: TestRow, filter: Filter) {
  const actual = row[filter.column];
  switch (filter.operator) {
    case "eq":
      return actual === filter.value;
    case "neq":
      return actual !== filter.value;
    case "is":
      return actual === filter.value;
    case "gte":
      return String(actual) >= String(filter.value);
    case "lte":
      return String(actual) <= String(filter.value);
    case "ilike": {
      const needle = String(filter.value).replaceAll("%", "").toLowerCase();
      return lower(actual).includes(needle);
    }
    case "in":
      return Array.isArray(filter.value) && filter.value.includes(actual);
    case "or":
      return String(filter.value)
        .split(",")
        .some((part) => {
          const [column, operator, ...rest] = part.split(".");
          if (operator !== "ilike") return false;
          const expected = rest.join(".").replaceAll("%", "");
          return lower(row[column]).includes(expected.toLowerCase());
        });
  }
}

function attachJoins(table: SupabaseTableName, row: TestRow, tables: TestDb) {
  const copy = cloneRow(row);
  if (table === "sales") {
    copy.client = ensureRows(tables, "clients").find(
      (client) => client.id === copy.client_id,
    );
    copy.professional = ensureRows(tables, "professionals").find(
      (professional) => professional.user_id === copy.professional_id,
    );
    copy.items = ensureRows(tables, "sale_items")
      .filter((item) => item.sale_id === copy.id)
      .map((item) => attachJoins("sale_items", item, tables));
    copy.payments = ensureRows(tables, "payments").filter(
      (payment) => payment.sale_id === copy.id,
    );
  }
  if (table === "sale_items") {
    copy.professional = ensureRows(tables, "professionals").find(
      (professional) => professional.user_id === copy.professional_id,
    );
    copy.variant = ensureRows(tables, "service_variants").find(
      (variant) => variant.id === copy.service_variant_id,
    );
    if (copy.variant && typeof copy.variant === "object") {
      const variant = copy.variant as TestRow;
      variant.service = ensureRows(tables, "services").find(
        (service) => service.id === variant.service_id,
      );
    }
  }
  if (table === "payments") {
    copy.professional = ensureRows(tables, "professionals").find(
      (professional) => professional.user_id === copy.professional_id,
    );
    copy.sale = attachJoins(
      "sales",
      ensureRows(tables, "sales").find((sale) => sale.id === copy.sale_id) ??
        {},
      tables,
    );
  }
  if (table === "appointments") {
    copy.clients = ensureRows(tables, "clients").find(
      (client) => client.id === copy.client_id,
    );
    copy.professional = ensureRows(tables, "professionals").find(
      (professional) => professional.user_id === copy.professional_id,
    );
    copy.appointment_services = ensureRows(
      tables,
      "appointment_services",
    ).filter((service) => service.appointment_id === copy.id);
    copy.sales = ensureRows(tables, "sales").filter(
      (sale) => sale.appointment_id === copy.id,
    );
  }
  if (table === "services") {
    copy.service_variants = ensureRows(tables, "service_variants").filter(
      (variant) => variant.service_id === copy.id,
    );
  }
  return copy;
}

class QueryBuilder implements PromiseLike<QueryResult> {
  private filters: Filter[] = [];
  private mutation: Mutation = "select";
  private payload: TestRow[] = [];
  private wantsSingle = false;
  private selected = "";
  private orderBy: { column: string; ascending: boolean } | null = null;
  private rangeValue: { from: number; to: number } | null = null;
  private limitValue: number | null = null;

  constructor(
    private readonly client: MockSupabaseClient,
    private readonly table: SupabaseTableName,
  ) {}

  select(columns = "*") {
    this.selected = columns;
    if (this.mutation === "insert" || this.mutation === "update") return this;
    this.mutation = "select";
    return this;
  }

  insert(payload: TestRow | TestRow[]) {
    this.mutation = "insert";
    this.payload = Array.isArray(payload) ? payload : [payload];
    return this;
  }

  update(payload: TestRow) {
    this.mutation = "update";
    this.payload = [payload];
    return this;
  }

  upsert(payload: TestRow | TestRow[]) {
    this.mutation = "upsert";
    this.payload = Array.isArray(payload) ? payload : [payload];
    return this;
  }

  delete() {
    this.mutation = "delete";
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ operator: "eq", column, value });
    return this;
  }

  neq(column: string, value: unknown) {
    this.filters.push({ operator: "neq", column, value });
    return this;
  }

  is(column: string, value: unknown) {
    this.filters.push({ operator: "is", column, value });
    return this;
  }

  gte(column: string, value: unknown) {
    this.filters.push({ operator: "gte", column, value });
    return this;
  }

  lte(column: string, value: unknown) {
    this.filters.push({ operator: "lte", column, value });
    return this;
  }

  ilike(column: string, value: unknown) {
    this.filters.push({ operator: "ilike", column, value });
    return this;
  }

  in(column: string, value: unknown[]) {
    this.filters.push({ operator: "in", column, value });
    return this;
  }

  or(value: string) {
    this.filters.push({ operator: "or", column: "", value });
    return this;
  }

  order(column: string, opts: { ascending?: boolean } = {}) {
    this.orderBy = { column, ascending: opts.ascending !== false };
    return this;
  }

  range(from: number, to: number) {
    this.rangeValue = { from, to };
    return this;
  }

  limit(value: number) {
    this.limitValue = value;
    return this;
  }

  single() {
    this.wantsSingle = true;
    return this;
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?:
      | ((value: QueryResult) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }

  private visibleRows() {
    return ensureRows(this.client.tables, this.table).filter((row) =>
      rlsAllows(this.client, this.table, "select", row),
    );
  }

  private filteredRows() {
    return this.visibleRows().filter((row) =>
      this.filters.every((filter) => matchesFilter(row, filter)),
    );
  }

  private shapeRows(rows: TestRow[]) {
    const joined = rows.map((row) =>
      this.selected.includes("(") ? attachJoins(this.table, row, this.client.tables) : cloneRow(row),
    );

    if (!this.orderBy) return joined;
    return joined.sort((a, b) => {
      const left = String(a[this.orderBy?.column ?? ""] ?? "");
      const right = String(b[this.orderBy?.column ?? ""] ?? "");
      return this.orderBy?.ascending ? left.localeCompare(right) : right.localeCompare(left);
    });
  }

  private selectRows(): QueryResult {
    let rows = this.shapeRows(this.filteredRows());
    if (this.rangeValue) {
      rows = rows.slice(this.rangeValue.from, this.rangeValue.to + 1);
    }
    if (this.limitValue !== null) rows = rows.slice(0, this.limitValue);
    if (this.wantsSingle) {
      const row = rows[0] ?? null;
      return row
        ? { data: row, error: null }
        : { data: null, error: { code: "PGRST116", message: "No rows" } };
    }
    return { data: rows, error: null };
  }

  private insertRows(): QueryResult {
    const rows = ensureRows(this.client.tables, this.table);
    const inserted: TestRow[] = [];
    for (const raw of this.payload) {
      const row = { ...raw };
      if (row.id === undefined && this.table !== "professionals") {
        row.id = nextId(rows);
      }
      if (!rlsAllows(this.client, this.table, "insert", undefined, row)) {
        return makeDenied(this.table, "insert");
      }
      rows.push(row);
      inserted.push(row);
    }
    return this.wantsSingle
      ? { data: cloneRow(inserted[0] ?? null), error: null }
      : { data: inserted.map(cloneRow), error: null };
  }

  private updateRows(): QueryResult {
    const rows = ensureRows(this.client.tables, this.table);
    const changed: TestRow[] = [];
    for (const row of rows) {
      if (!this.filters.every((filter) => matchesFilter(row, filter))) continue;
      if (!rlsAllows(this.client, this.table, "update", row, this.payload[0])) {
        return makeDenied(this.table, "update");
      }
      Object.assign(row, this.payload[0]);
      changed.push(row);
    }
    return this.wantsSingle
      ? { data: cloneRow(changed[0] ?? null), error: changed[0] ? null : { code: "PGRST116", message: "No rows" } }
      : { data: changed.map(cloneRow), error: null };
  }

  private upsertRows(): QueryResult {
    const rows = ensureRows(this.client.tables, this.table);
    const saved: TestRow[] = [];
    for (const payload of this.payload) {
      const key = this.table === "app_settings" ? "key" : "id";
      const existing = rows.find((row) => row[key] === payload[key]);
      if (existing) {
        Object.assign(existing, payload);
        saved.push(existing);
      } else {
        rows.push({ ...payload });
        saved.push(payload);
      }
    }
    return this.wantsSingle
      ? { data: cloneRow(saved[0] ?? null), error: null }
      : { data: saved.map(cloneRow), error: null };
  }

  private deleteRows(): QueryResult {
    const rows = ensureRows(this.client.tables, this.table);
    const remaining: TestRow[] = [];
    const deleted: TestRow[] = [];
    for (const row of rows) {
      if (this.filters.every((filter) => matchesFilter(row, filter))) {
        if (!rlsAllows(this.client, this.table, "delete", row)) {
          return makeDenied(this.table, "delete");
        }
        deleted.push(row);
      } else {
        remaining.push(row);
      }
    }
    this.client.tables[this.table] = remaining;
    return { data: deleted.map(cloneRow), error: null };
  }

  execute(): QueryResult {
    switch (this.mutation) {
      case "insert":
        return this.insertRows();
      case "update":
        return this.updateRows();
      case "upsert":
        return this.upsertRows();
      case "delete":
        return this.deleteRows();
      case "select":
        return this.selectRows();
    }
  }
}

export class MockSupabaseClient {
  readonly mode: MockMode;
  readonly user?: MockUser;
  readonly tables: TestDb;
  private readonly rpcHandlers: NonNullable<MockSupabaseOptions["rpc"]>;

  constructor(options: MockSupabaseOptions = {}) {
    this.mode = options.mode ?? "admin";
    this.user = options.user;
    this.tables = {};
    for (const table of allTables) {
      this.tables[table] = (options.tables?.[table] ?? []).map(cloneRow);
    }
    this.rpcHandlers = options.rpc ?? {};
  }

  from(table: SupabaseTableName) {
    return new QueryBuilder(this, table);
  }

  async rpc(name: string, args: TestRow = {}): Promise<QueryResult> {
    const handler = this.rpcHandlers[name];
    if (!handler) {
      return {
        data: null,
        error: { message: `No RPC handler for ${name}` },
      };
    }
    try {
      return { data: handler(args, this), error: null };
    } catch (error) {
      return {
        data: null,
        error: {
          message: error instanceof Error ? error.message : "RPC failed",
        },
      };
    }
  }

  auth = {
    getSession: async () => ({
      data: {
        session: this.user
          ? { user: { id: this.user.id, email: `${this.user.id}@example.com` } }
          : null,
      },
    }),
    onAuthStateChange: (
      callback: (
        event: string,
        session: { user: { id: string; email: string } } | null,
      ) => void,
    ) => {
      callback(
        "INITIAL_SESSION",
        this.user
          ? { user: { id: this.user.id, email: `${this.user.id}@example.com` } }
          : null,
      );
      return { data: { subscription: { unsubscribe: () => undefined } } };
    },
    signInWithPassword: async () => ({
      data: {
        user: this.user
          ? { id: this.user.id, email: `${this.user.id}@example.com` }
          : null,
      },
      error: this.user ? null : { message: "Invalid login" },
    }),
    signOut: async () => ({ error: null }),
  };
}

export function createSupabaseMock(options: MockSupabaseOptions = {}) {
  return new MockSupabaseClient(options);
}

export function tableRows<T extends TestRow>(
  client: MockSupabaseClient,
  table: SupabaseTableName,
) {
  return ensureRows(client.tables, table) as T[];
}
