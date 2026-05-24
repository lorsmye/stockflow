"use client";

import {
  ArrowRightLeft,
  BarChart3,
  Building2,
  Eye,
  LayoutDashboard,
  Package,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type Product = {
  id: string;
  sku: string;
  name: string;
  price: number;
  category: string;
};

type Branch = {
  id: string;
  name: string;
  location: string;
};

type BranchStock = {
  branchId: string;
  branchName: string;
  quantity: number;
};

type StockRow = {
  product: Product;
  total: number;
  byBranch: BranchStock[];
};

type StocksPayload = {
  products: Product[];
  branches: Branch[];
  rows: StockRow[];
};

type MovementStatus = "pending" | "processed" | "failed";
type MovementType = "IN" | "OUT" | "TRANSFER";

type MaybePopulated<T> = T | string | null | undefined;

type Movement = {
  id: string;
  type: MovementType;
  productId: MaybePopulated<Product>;
  quantity: number;
  fromBranchId?: MaybePopulated<Branch>;
  toBranchId?: MaybePopulated<Branch>;
  status: MovementStatus;
  attempts: number;
  maxAttempts: number;
  failureReason?: string;
  processedAt?: string;
  createdAt: string;
};

type ReportPayload = {
  from: string | null;
  to: string | null;
  total: number;
  byType: Array<{ type: MovementType; count: number }>;
  byBranch: Array<{ branchId: string; branchName: string; count: number }>;
};

type WorkerSummary = {
  processed: number;
  retried: number;
  failed: number;
  checked: number;
};

type ApiResponse<T> = {
  data?: T;
  error?: string;
  issues?: Array<{ path: string; message: string }>;
};

type Tab = "dashboard" | "products" | "branches" | "movements" | "reports";
type AlertPhase = "visible" | "hiding";

type DeleteConfirmation =
  | { kind: "product"; product: Product }
  | { kind: "branch"; branch: Branch }
  | null;

const moneyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});

const dateFormatter = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
  timeStyle: "short",
});

const tabs: Array<{ id: Tab; label: string; Icon: LucideIcon }> = [
  { id: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { id: "products", label: "Productos", Icon: Package },
  { id: "branches", label: "Sucursales", Icon: Building2 },
  { id: "movements", label: "Movimientos", Icon: ArrowRightLeft },
  { id: "reports", label: "Reporte", Icon: BarChart3 },
];

const movementTypeLabels: Record<MovementType, string> = {
  IN: "Entrada",
  OUT: "Salida",
  TRANSFER: "Transferencia",
};

const statusLabels: Record<MovementStatus, string> = {
  pending: "Pendiente",
  processed: "Procesado",
  failed: "Fallido",
};

const emptyProductForm = {
  sku: "",
  name: "",
  price: "",
  category: "",
};

const emptyBranchForm = {
  name: "",
  location: "",
};

const emptyMovementForm = {
  type: "IN" as MovementType,
  productId: "",
  quantity: "1",
  fromBranchId: "",
  toBranchId: "",
};

export function StockFlowApp() {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [products, setProducts] = useState<Product[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [stockRows, setStockRows] = useState<StockRow[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [report, setReport] = useState<ReportPayload | null>(null);
  const [selectedMovement, setSelectedMovement] = useState<Movement | null>(null);
  const [productForm, setProductForm] = useState(emptyProductForm);
  const [branchForm, setBranchForm] = useState(emptyBranchForm);
  const [movementForm, setMovementForm] = useState(emptyMovementForm);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
  const [movementStatusFilter, setMovementStatusFilter] = useState("");
  const [movementBranchFilter, setMovementBranchFilter] = useState("");
  const [reportFilters, setReportFilters] = useState({ from: "", to: "" });
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [alertPhase, setAlertPhase] = useState<AlertPhase>("visible");
  const [deleteConfirmation, setDeleteConfirmation] = useState<DeleteConfirmation>(null);

  const showNotice = useCallback((message: string) => {
    setAlertPhase("visible");
    setNotice(message);
  }, []);

  const showError = useCallback((message: string) => {
    setAlertPhase("visible");
    setError(message);
  }, []);

  const loadProducts = useCallback(async () => {
    const data = await apiRequest<Product[]>("/api/products");
    setProducts(data);
  }, []);

  const loadBranches = useCallback(async () => {
    const data = await apiRequest<Branch[]>("/api/branches");
    setBranches(data);
  }, []);

  const loadStocks = useCallback(async () => {
    const data = await apiRequest<StocksPayload>("/api/stocks");
    setStockRows(data.rows);
  }, []);

  const loadMovements = useCallback(async () => {
    const query = buildQuery({
      status: movementStatusFilter,
      branchId: movementBranchFilter,
    });
    const data = await apiRequest<Movement[]>(`/api/movements${query}`);
    setMovements(data);
  }, [movementBranchFilter, movementStatusFilter]);

  const loadReport = useCallback(async () => {
    const query = buildQuery(reportFilters);
    const data = await apiRequest<ReportPayload>(`/api/reports/movements${query}`);
    setReport(data);
  }, [reportFilters]);

  const refreshOperationalData = useCallback(async () => {
    await Promise.all([loadProducts(), loadBranches(), loadStocks(), loadMovements()]);
  }, [loadBranches, loadMovements, loadProducts, loadStocks]);

  useEffect(() => {
    async function boot() {
      try {
        setIsLoading(true);
        await refreshOperationalData();
        const initialReport = await apiRequest<ReportPayload>("/api/reports/movements");
        setReport(initialReport);
      } catch (requestError) {
        showError(getErrorMessage(requestError));
      } finally {
        setIsLoading(false);
      }
    }

    void boot();
  }, [refreshOperationalData, showError]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadMovements().catch(() => undefined);
      void loadStocks().catch(() => undefined);
    }, 5000);

    return () => window.clearInterval(interval);
  }, [loadMovements, loadStocks]);

  useEffect(() => {
    if (!error && !notice) {
      return;
    }
    const hideTimer = window.setTimeout(() => {
      setAlertPhase("hiding");
    }, 3700);
    const clearTimer = window.setTimeout(() => {
      setError("");
      setNotice("");
      setAlertPhase("visible");
    }, 4000);

    return () => {
      window.clearTimeout(hideTimer);
      window.clearTimeout(clearTimer);
    };
  }, [error, notice]);

  const stats = useMemo(() => {
    const totalUnits = stockRows.reduce((sum, row) => sum + row.total, 0);
    const pending = movements.filter((movement) => movement.status === "pending").length;
    const failed = movements.filter((movement) => movement.status === "failed").length;

    return { totalUnits, pending, failed };
  }, [movements, stockRows]);

  async function runAction(action: () => Promise<void>, successMessage?: string) {
    try {
      setIsBusy(true);
      setError("");
      setNotice("");
      await action();

      if (successMessage) {
        showNotice(successMessage);
      }
    } catch (requestError) {
      showError(getErrorMessage(requestError));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleProductSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await runAction(async () => {
      const method = editingProductId ? "PUT" : "POST";
      const path = editingProductId ? `/api/products/${editingProductId}` : "/api/products";
      await apiRequest<Product>(path, {
        method,
        body: JSON.stringify(productForm),
      });
      setProductForm(emptyProductForm);
      setEditingProductId(null);
      await Promise.all([loadProducts(), loadStocks()]);
    }, "Producto guardado.");
  }

  async function handleBranchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await runAction(async () => {
      const method = editingBranchId ? "PUT" : "POST";
      const path = editingBranchId ? `/api/branches/${editingBranchId}` : "/api/branches";
      await apiRequest<Branch>(path, {
        method,
        body: JSON.stringify(branchForm),
      });
      setBranchForm(emptyBranchForm);
      setEditingBranchId(null);
      await Promise.all([loadBranches(), loadStocks()]);
    }, "Sucursal guardada.");
  }

  async function handleMovementSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await runAction(async () => {
      await apiRequest<Movement>("/api/movements", {
        method: "POST",
        body: JSON.stringify(movementForm),
      });
      setMovementForm({ ...emptyMovementForm, productId: movementForm.productId });
      await Promise.all([loadMovements(), loadStocks()]);

      window.setTimeout(() => {
        void loadMovements().catch(() => undefined);
        void loadStocks().catch(() => undefined);
      }, 1200);
    }, "Movimiento registrado como pendiente.");
  }

  async function confirmDelete() {
    if (!deleteConfirmation) {
      return;
    }

    const target = deleteConfirmation;
    await runAction(async () => {
      if (target.kind === "product") {
        await apiRequest<Product>(`/api/products/${target.product.id}`, { method: "DELETE" });
        await Promise.all([loadProducts(), loadStocks(), loadMovements()]);
      } else {
        await apiRequest<Branch>(`/api/branches/${target.branch.id}`, { method: "DELETE" });
        await Promise.all([loadBranches(), loadStocks(), loadMovements()]);
      }

      setDeleteConfirmation(null);
    }, target.kind === "product" ? "Producto eliminado." : "Sucursal eliminada.");
  }

  async function processPending() {
    await runAction(async () => {
      const summary = await apiRequest<WorkerSummary>("/api/worker/process?limit=10", {
        method: "POST",
      });
      await Promise.all([loadMovements(), loadStocks()]);
      showNotice(
        `Worker reviso ${summary.checked}, proceso ${summary.processed}, reintento ${summary.retried} y fallo ${summary.failed}.`,
      );
    });
  }

  async function openMovementDetail(movementId: string) {
    await runAction(async () => {
      const movement = await apiRequest<Movement>(`/api/movements/${movementId}`);
      setSelectedMovement(movement);
    });
  }

  async function handleReportSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await runAction(async () => {
      await loadReport();
    }, "Reporte actualizado.");
  }

  function editProduct(product: Product) {
    setEditingProductId(product.id);
    setProductForm({
      sku: product.sku,
      name: product.name,
      price: String(product.price),
      category: product.category,
    });
  }

  function editBranch(branch: Branch) {
    setEditingBranchId(branch.id);
    setBranchForm({
      name: branch.name,
      location: branch.location,
    });
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <span className="eyebrow">StockFlow</span>
          <h1>Control de inventario</h1>
          <p>
            Inventario multi-sucursal con movimientos asincronos, reintentos y stock
            consolidado.
          </p>
        </div>
        <div className="status-pill">
          <RefreshCw size={16} />
          {isLoading ? "Cargando datos" : `${stats.pending} pendientes`}
        </div>
      </header>

      <nav className="tabs" aria-label="Vistas">
        {tabs.map(({ id, label, Icon }) => (
          <button
            className={`tab-button ${activeTab === id ? "active" : ""}`}
            key={id}
            onClick={() => setActiveTab(id)}
            type="button"
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </nav>

      {error ? <div className={`alert error ${alertPhase}`}>{error}</div> : null}
      {notice ? <div className={`alert success ${alertPhase}`}>{notice}</div> : null}

      {activeTab === "dashboard" ? renderDashboard() : null}
      {activeTab === "products" ? renderProducts() : null}
      {activeTab === "branches" ? renderBranches() : null}
      {activeTab === "movements" ? renderMovements() : null}
      {activeTab === "reports" ? renderReports() : null}
      {deleteConfirmation ? renderDeleteConfirmation() : null}
    </main>
  );

  function renderDashboard() {
    return (
      <section className="layout-grid">
        <div className="stats-grid">
          <div className="stat">
            <span>Productos</span>
            <strong>{products.length}</strong>
          </div>
          <div className="stat">
            <span>Sucursales</span>
            <strong>{branches.length}</strong>
          </div>
          <div className="stat">
            <span>Unidades</span>
            <strong>{stats.totalUnits}</strong>
          </div>
          <div className="stat">
            <span>Alertas</span>
            <strong>{stats.pending + stats.failed}</strong>
          </div>
        </div>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Stock por producto</h2>
              <p>Totales consolidados y distribucion por sucursal.</p>
            </div>
            <button
              className="button"
              disabled={isBusy}
              onClick={() => void refreshOperationalData()}
              type="button"
            >
              <RefreshCw size={16} />
              Actualizar
            </button>
          </div>

          {stockRows.length ? (
            <div className="stock-grid">
              {stockRows.map((row) => (
                <article className="stock-card" key={row.product.id}>
                  <h3>{row.product.name}</h3>
                  <p className="muted">
                    {row.product.sku} - {row.product.category}
                  </p>
                  <div className="stock-total">{row.total} unidades</div>
                  <div className="branch-stock">
                    {row.byBranch.map((branch) => (
                      <div key={branch.branchId}>
                        <span>{branch.branchName}</span>
                        <strong>{branch.quantity}</strong>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="empty-state">Sin inventario registrado.</p>
          )}
        </section>
      </section>
    );
  }

  function renderProducts() {
    return (
      <section className="layout-grid two">
        <form className="panel form-grid" onSubmit={handleProductSubmit}>
          <div className="panel-header">
            <div>
              <h2>{editingProductId ? "Editar producto" : "Nuevo producto"}</h2>
              <p>SKU, precio y categoria.</p>
            </div>
          </div>
          <div className="form-grid two">
            <div className="field">
              <label htmlFor="sku">SKU</label>
              <input
                id="sku"
                onChange={(event) =>
                  setProductForm((current) => ({ ...current, sku: event.target.value }))
                }
                required
                value={productForm.sku}
              />
            </div>
            <div className="field">
              <label htmlFor="price">Precio</label>
              <input
                id="price"
                min="0"
                onChange={(event) =>
                  setProductForm((current) => ({ ...current, price: event.target.value }))
                }
                required
                step="0.01"
                type="number"
                value={productForm.price}
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="product-name">Nombre</label>
            <input
              id="product-name"
              onChange={(event) =>
                setProductForm((current) => ({ ...current, name: event.target.value }))
              }
              required
              value={productForm.name}
            />
          </div>
          <div className="field">
            <label htmlFor="category">Categoria</label>
            <input
              id="category"
              onChange={(event) =>
                setProductForm((current) => ({ ...current, category: event.target.value }))
              }
              required
              value={productForm.category}
            />
          </div>
          <div className="actions">
            <button className="button primary" disabled={isBusy} type="submit">
              <Save size={16} />
              Guardar
            </button>
            {editingProductId ? (
              <button
                className="button"
                onClick={() => {
                  setEditingProductId(null);
                  setProductForm(emptyProductForm);
                }}
                type="button"
              >
                <X size={16} />
                Cancelar
              </button>
            ) : null}
          </div>
        </form>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Productos</h2>
              <p>{products.length} registros.</p>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Nombre</th>
                  <th>Categoria</th>
                  <th>Precio</th>
                  <th aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id}>
                    <td>{product.sku}</td>
                    <td>{product.name}</td>
                    <td>{product.category}</td>
                    <td>{moneyFormatter.format(product.price)}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="icon-button"
                          onClick={() => editProduct(product)}
                          title="Editar producto"
                          type="button"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="icon-button danger"
                          onClick={() => setDeleteConfirmation({ kind: "product", product })}
                          title="Eliminar producto"
                          type="button"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    );
  }

  function renderBranches() {
    return (
      <section className="layout-grid two">
        <form className="panel form-grid" onSubmit={handleBranchSubmit}>
          <div className="panel-header">
            <div>
              <h2>{editingBranchId ? "Editar sucursal" : "Nueva sucursal"}</h2>
              <p>Nombre y ubicacion operativa.</p>
            </div>
          </div>
          <div className="field">
            <label htmlFor="branch-name">Nombre</label>
            <input
              id="branch-name"
              onChange={(event) =>
                setBranchForm((current) => ({ ...current, name: event.target.value }))
              }
              required
              value={branchForm.name}
            />
          </div>
          <div className="field">
            <label htmlFor="branch-location">Ubicacion</label>
            <input
              id="branch-location"
              onChange={(event) =>
                setBranchForm((current) => ({ ...current, location: event.target.value }))
              }
              required
              value={branchForm.location}
            />
          </div>
          <div className="actions">
            <button className="button primary" disabled={isBusy} type="submit">
              <Save size={16} />
              Guardar
            </button>
            {editingBranchId ? (
              <button
                className="button"
                onClick={() => {
                  setEditingBranchId(null);
                  setBranchForm(emptyBranchForm);
                }}
                type="button"
              >
                <X size={16} />
                Cancelar
              </button>
            ) : null}
          </div>
        </form>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Sucursales</h2>
              <p>{branches.length} registros.</p>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Ubicacion</th>
                  <th aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {branches.map((branch) => (
                  <tr key={branch.id}>
                    <td>{branch.name}</td>
                    <td>{branch.location}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="icon-button"
                          onClick={() => editBranch(branch)}
                          title="Editar sucursal"
                          type="button"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="icon-button danger"
                          onClick={() => setDeleteConfirmation({ kind: "branch", branch })}
                          title="Eliminar sucursal"
                          type="button"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    );
  }

  function renderMovements() {
    return (
      <section className="layout-grid two">
        <form className="panel form-grid" onSubmit={handleMovementSubmit}>
          <div className="panel-header">
            <div>
              <h2>Nuevo movimiento</h2>
              <p>Entrada, salida o transferencia.</p>
            </div>
          </div>
          <div className="field">
            <label htmlFor="movement-type">Tipo</label>
            <select
              id="movement-type"
              onChange={(event) => {
                const nextType = event.target.value as MovementType;
                setMovementForm((current) => ({
                  ...current,
                  type: nextType,
                  fromBranchId: nextType === "IN" ? "" : current.fromBranchId,
                  toBranchId: nextType === "OUT" ? "" : current.toBranchId,
                }));
              }}
              value={movementForm.type}
            >
              <option value="IN">Entrada</option>
              <option value="OUT">Salida</option>
              <option value="TRANSFER">Transferencia</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="movement-product">Producto</label>
            <select
              id="movement-product"
              onChange={(event) =>
                setMovementForm((current) => ({ ...current, productId: event.target.value }))
              }
              required
              value={movementForm.productId}
            >
              <option value="">Selecciona producto</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.sku} - {product.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="movement-quantity">Cantidad</label>
            <input
              id="movement-quantity"
              min="1"
              onChange={(event) =>
                setMovementForm((current) => ({ ...current, quantity: event.target.value }))
              }
              required
              type="number"
              value={movementForm.quantity}
            />
          </div>
          <div className="form-grid two">
            <div className="field">
              <label htmlFor="from-branch">Origen</label>
              <select
                disabled={movementForm.type === "IN"}
                id="from-branch"
                onChange={(event) =>
                  setMovementForm((current) => ({
                    ...current,
                    fromBranchId: event.target.value,
                  }))
                }
                required={movementForm.type !== "IN"}
                value={movementForm.fromBranchId}
              >
                <option value="">Sin origen</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="to-branch">Destino</label>
              <select
                disabled={movementForm.type === "OUT"}
                id="to-branch"
                onChange={(event) =>
                  setMovementForm((current) => ({ ...current, toBranchId: event.target.value }))
                }
                required={movementForm.type !== "OUT"}
                value={movementForm.toBranchId}
              >
                <option value="">Sin destino</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="actions">
            <button className="button primary" disabled={isBusy} type="submit">
              <Plus size={16} />
              Registrar
            </button>
            <button
              className="button warning"
              disabled={isBusy}
              onClick={() => void processPending()}
              type="button"
            >
              <Play size={16} />
              Procesar
            </button>
          </div>
        </form>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Historial</h2>
              <p>{movements.length} movimientos visibles.</p>
            </div>
            <div className="actions">
              <select
                aria-label="Filtrar por estado"
                onChange={(event) => setMovementStatusFilter(event.target.value)}
                value={movementStatusFilter}
              >
                <option value="">Todos</option>
                <option value="pending">Pendientes</option>
                <option value="processed">Procesados</option>
                <option value="failed">Fallidos</option>
              </select>
              <select
                aria-label="Filtrar por sucursal"
                onChange={(event) => setMovementBranchFilter(event.target.value)}
                value={movementBranchFilter}
              >
                <option value="">Todas</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Estado</th>
                  <th>Tipo</th>
                  <th>Producto</th>
                  <th>Cantidad</th>
                  <th>Ruta</th>
                  <th>Fecha</th>
                  <th aria-label="Detalle" />
                </tr>
              </thead>
              <tbody>
                {movements.map((movement) => (
                  <tr key={movement.id}>
                    <td>
                      <span className={`badge ${movement.status}`}>
                        {statusLabels[movement.status]}
                      </span>
                    </td>
                    <td>{movementTypeLabels[movement.type]}</td>
                    <td>{productLabel(movement.productId, products)}</td>
                    <td>{movement.quantity}</td>
                    <td>{movementRouteLabel(movement, branches)}</td>
                    <td>{formatDate(movement.createdAt)}</td>
                    <td>
                      <button
                        className="icon-button"
                        onClick={() => void openMovementDetail(movement.id)}
                        title="Ver detalle"
                        type="button"
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selectedMovement ? (
            <div className="detail-box" style={{ marginTop: 16 }}>
              <div className="panel-header">
                <div>
                  <h3>Detalle de movimiento</h3>
                  <p>{selectedMovement.id}</p>
                </div>
                <button
                  className="icon-button"
                  onClick={() => setSelectedMovement(null)}
                  title="Cerrar detalle"
                  type="button"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="detail-grid">
                <Detail label="Estado" value={statusLabels[selectedMovement.status]} />
                <Detail label="Tipo" value={movementTypeLabels[selectedMovement.type]} />
                <Detail label="Producto" value={productLabel(selectedMovement.productId, products)} />
                <Detail label="Cantidad" value={String(selectedMovement.quantity)} />
                <Detail
                  label="Origen/Destino"
                  value={movementRouteLabel(selectedMovement, branches)}
                />
                <Detail
                  label="Intentos"
                  value={`${selectedMovement.attempts}/${selectedMovement.maxAttempts}`}
                />
                <Detail label="Creado" value={formatDate(selectedMovement.createdAt)} />
                <Detail
                  label="Procesado"
                  value={selectedMovement.processedAt ? formatDate(selectedMovement.processedAt) : "-"}
                />
              </div>
              {selectedMovement.failureReason ? (
                <p className="muted" style={{ marginTop: 12 }}>
                  {selectedMovement.failureReason}
                </p>
              ) : null}
            </div>
          ) : null}
        </section>
      </section>
    );
  }

  function renderReports() {
    return (
      <section className="layout-grid">
        <form className="panel form-grid" onSubmit={handleReportSubmit}>
          <div className="panel-header">
            <div>
              <h2>Reporte de movimientos</h2>
              <p>Totales por tipo y por sucursal.</p>
            </div>
          </div>
          <div className="form-grid two">
            <div className="field">
              <label htmlFor="from-date">Desde</label>
              <input
                id="from-date"
                onChange={(event) =>
                  setReportFilters((current) => ({ ...current, from: event.target.value }))
                }
                type="date"
                value={reportFilters.from}
              />
            </div>
            <div className="field">
              <label htmlFor="to-date">Hasta</label>
              <input
                id="to-date"
                onChange={(event) =>
                  setReportFilters((current) => ({ ...current, to: event.target.value }))
                }
                type="date"
                value={reportFilters.to}
              />
            </div>
          </div>
          <div className="actions">
            <button className="button primary" disabled={isBusy} type="submit">
              <BarChart3 size={16} />
              Generar
            </button>
            <button
              className="button"
              onClick={() => void clearReport()}
              type="button"
            >
              <RotateCcw size={16} />
              Limpiar
            </button>
          </div>
        </form>

        {report ? (
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Total: {report.total}</h2>
                <p>
                  {report.from ?? "Inicio"} - {report.to ?? "Hoy"}
                </p>
              </div>
            </div>
            <div className="report-grid">
              <div className="report-box">
                <h3>Por tipo</h3>
                {report.byType.length ? (
                  report.byType.map((item) => (
                    <Detail
                      key={item.type}
                      label={movementTypeLabels[item.type]}
                      value={String(item.count)}
                    />
                  ))
                ) : (
                  <p className="empty-state">Sin movimientos.</p>
                )}
              </div>
              <div className="report-box">
                <h3>Por sucursal</h3>
                {report.byBranch.length ? (
                  report.byBranch.map((item) => (
                    <Detail key={item.branchId} label={item.branchName} value={String(item.count)} />
                  ))
                ) : (
                  <p className="empty-state">Sin sucursales en el rango.</p>
                )}
              </div>
            </div>
          </section>
        ) : null}
      </section>
    );
  }

  async function clearReport() {
    await runAction(async () => {
      setReportFilters({ from: "", to: "" });
      const data = await apiRequest<ReportPayload>("/api/reports/movements");
      setReport(data);
    }, "Reporte actualizado.");
  }

  function renderDeleteConfirmation() {
    if (!deleteConfirmation) {
      return null;
    }

    const isProduct = deleteConfirmation.kind === "product";
    const title = isProduct
      ? `Eliminar ${deleteConfirmation.product.name}`
      : `Eliminar ${deleteConfirmation.branch.name}`;
    const description = isProduct
      ? `Se borrara el producto ${deleteConfirmation.product.sku} y su stock asociado.`
      : `Se borrara la sucursal ${deleteConfirmation.branch.name} y su stock asociado.`;

    return (
      <div className="modal-backdrop" role="presentation">
        <section
          aria-labelledby="delete-confirmation-title"
          aria-modal="true"
          className="confirm-dialog"
          role="dialog"
        >
          <div className="confirm-icon">
            <Trash2 size={22} />
          </div>
          <div>
            <h2 id="delete-confirmation-title">{title}</h2>
            <p>{description}</p>
            <p>Esta accion no se puede deshacer.</p>
          </div>
          <div className="confirm-actions">
            <button
              className="button"
              disabled={isBusy}
              onClick={() => setDeleteConfirmation(null)}
              type="button"
            >
              Cancelar
            </button>
            <button
              className="button danger-solid"
              disabled={isBusy}
              onClick={() => void confirmDelete()}
              type="button"
            >
              <Trash2 size={16} />
              Aceptar, borrar
            </button>
          </div>
        </section>
      </div>
    );
  }
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="muted">{label}</p>
      <strong>{value}</strong>
    </div>
  );
}

async function apiRequest<T>(path: string, options: RequestInit = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  const body = (await response.json().catch(() => ({}))) as ApiResponse<T>;

  if (!response.ok) {
    const issueText = body.issues?.map((issue) => issue.message).join(" ");
    throw new Error(issueText || body.error || "Operacion fallida.");
  }

  return body.data as T;
}

function buildQuery(values: Record<string, string>) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(values)) {
    if (value) {
      params.set(key, value);
    }
  }

  const query = params.toString();
  return query ? `?${query}` : "";
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Operacion fallida.";
}

function productLabel(value: MaybePopulated<Product>, products: Product[]) {
  if (isPopulated(value)) {
    return `${value.sku} - ${value.name}`;
  }

  const fallback = products.find((product) => product.id === value);
  return fallback ? `${fallback.sku} - ${fallback.name}` : "Producto eliminado";
}

function branchLabel(value: MaybePopulated<Branch>, branches: Branch[]) {
  if (isPopulated(value)) {
    return value.name;
  }

  const fallback = branches.find((branch) => branch.id === value);
  return fallback ? fallback.name : "Sin sucursal";
}

function movementRouteLabel(movement: Movement, branches: Branch[]) {
  if (movement.type === "IN") {
    return `Entrada a ${branchLabel(movement.toBranchId, branches)}`;
  }

  if (movement.type === "OUT") {
    return `Salida de ${branchLabel(movement.fromBranchId, branches)}`;
  }

  return `${branchLabel(movement.fromBranchId, branches)} -> ${branchLabel(
    movement.toBranchId,
    branches,
  )}`;
}

function isPopulated<T extends { id: string }>(value: MaybePopulated<T>): value is T {
  return typeof value === "object" && value !== null && "id" in value;
}

function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}
