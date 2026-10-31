import React, { useEffect, useState, useMemo } from 'react';
import { CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { api } from '../../services/api';
import { Project, SecondaryMarketOrder, Investment } from '../../types';
import { useAuth } from '../auth/AuthContext';
import { formatNumber, formatUSD } from '../../utils/formatters';
import './SecondaryMarketPage.css';

export const SecondaryMarketPage: React.FC = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<SecondaryMarketOrder[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Form State
  const [orderType, setOrderType] = useState<'buy' | 'sell'>('buy');
  const [amountTokens, setAmountTokens] = useState<number>(10);
  const [pricePerToken, setPricePerToken] = useState<number>(100);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [allOrders, allProjects, balance, userInvs] = await Promise.all([
        api.getMarketOrders(),
        api.getProjects(),
        api.getUserBalance(user?.id),
        api.getInvestments(user?.id),
      ]);

      setOrders(allOrders);
      setProjects(allProjects);
      setWalletBalance(balance);
      setInvestments(userInvs);

      if (allProjects.length > 0 && !selectedProjectId) {
        setSelectedProjectId(allProjects[0].id);
      }
    } catch (err: any) {
      console.error('Error cargando mercado secundario:', err);
      setLoadError('No se pudieron cargar los datos del mercado. Por favor, reintentá.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.id]);

  // Selected project reference
  const selectedProject = useMemo(() => {
    return projects.find((p) => p.id === selectedProjectId) || projects[0] || null;
  }, [projects, selectedProjectId]);

  // User holdings in the selected project
  const userTokensInProject = useMemo(() => {
    if (!selectedProjectId) return 0;
    return investments
      .filter((inv) => inv.projectId === selectedProjectId)
      .reduce((sum, inv) => sum + inv.tokens, 0);
  }, [investments, selectedProjectId]);

  // Project orders filtered exclusively for selected project
  const projectOrders = useMemo(() => {
    if (!selectedProjectId) return [];
    return orders.filter((o) => o.projectId === selectedProjectId && o.status === 'open');
  }, [orders, selectedProjectId]);

  // Buy orders: Descending by price (highest bid on top)
  const buyOrders = useMemo(() => {
    return projectOrders
      .filter((o) => o.type === 'buy')
      .sort((a, b) => b.pricePerToken - a.pricePerToken);
  }, [projectOrders]);

  // Sell orders: Ascending by price (lowest ask on top)
  const sellOrders = useMemo(() => {
    return projectOrders
      .filter((o) => o.type === 'sell')
      .sort((a, b) => a.pricePerToken - b.pricePerToken);
  }, [projectOrders]);

  // Prepare form when clicking an order book row (never auto-submits)
  const handleSelectOrder = (order: SecondaryMarketOrder) => {
    setActionMessage(null);
    if (order.type === 'sell') {
      // Clicking a sell order prepares a BUY order
      setOrderType('buy');
      setPricePerToken(order.pricePerToken);
      setAmountTokens(order.amountTokens);
    } else {
      // Clicking a buy order prepares a SELL order
      setOrderType('sell');
      setPricePerToken(order.pricePerToken);
      setAmountTokens(order.amountTokens);
    }
  };

  // Handle changing the shared project selector
  const handleProjectChange = (newProjectId: string) => {
    setSelectedProjectId(newProjectId);
    setActionMessage(null);
    setPricePerToken(100);
    setAmountTokens(10);
  };

  // Submit new limit order
  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionMessage(null);

    if (!user) {
      setActionMessage({ text: 'Iniciá sesión para publicar órdenes en el mercado.', type: 'error' });
      return;
    }

    if (amountTokens <= 0 || isNaN(amountTokens)) {
      setActionMessage({ text: 'Ingresá una cantidad de tokens válida mayor a 0.', type: 'error' });
      return;
    }

    if (pricePerToken <= 0 || isNaN(pricePerToken)) {
      setActionMessage({ text: 'Ingresá un precio por token válido mayor a 0.', type: 'error' });
      return;
    }

    const totalOrderUSD = amountTokens * pricePerToken;

    // Validation: Buying with sufficient balance
    if (orderType === 'buy' && walletBalance < totalOrderUSD) {
      setActionMessage({
        text: `Saldo insuficiente en tu billetera (${formatUSD(walletBalance)}) para publicar una compra de ${formatUSD(totalOrderUSD)}.`,
        type: 'error',
      });
      return;
    }

    // Validation: Selling with sufficient token holdings
    if (orderType === 'sell' && amountTokens > userTokensInProject) {
      setActionMessage({
        text: `Tenencia insuficiente: poseés ${formatNumber(userTokensInProject)} tokens de este proyecto para vender.`,
        type: 'error',
      });
      return;
    }

    if (!selectedProject) return;

    setIsSubmitting(true);
    try {
      const newOrder = await api.createOrder({
        projectId: selectedProject.id,
        projectName: selectedProject.name,
        tokenSymbol: selectedProject.tokenSymbol || 'TKN',
        type: orderType,
        amountTokens,
        pricePerToken,
        sellerOrBuyerId: user.id,
      });

      setOrders((prev) => [newOrder, ...prev]);
      setActionMessage({
        text: `Orden de ${orderType === 'buy' ? 'compra' : 'venta'} publicada con éxito en el libro (estado: abierta).`,
        type: 'success',
      });

      // Refresh balance and orders
      const [updatedBalance, updatedOrders] = await Promise.all([
        api.getUserBalance(user.id),
        api.getMarketOrders(),
      ]);
      setWalletBalance(updatedBalance);
      setOrders(updatedOrders);
    } catch (err: any) {
      setActionMessage({
        text: err.message || 'No se pudo publicar la orden. Por favor, verificá los datos.',
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalEstimatedUSD = amountTokens * pricePerToken;

  return (
    <div className="sec-market-root">
      {/* ============================================================== */}
      {/* 1. ENCABEZADO Y SELECTOR COMPARTIDO DE PROYECTO               */}
      {/* ============================================================== */}
      <div className="sec-market-header">
        <h1 className="sec-market-title">Mercado secundario</h1>

        {/* Selector compartido: controla tanto el libro como la orden */}
        <div className="sec-market-selector-bar">
          <label htmlFor="sec-market-proj-select" className="sec-market-selector-label">
            Proyecto:
          </label>
          <select
            id="sec-market-proj-select"
            className="sec-market-select"
            value={selectedProjectId}
            onChange={(e) => handleProjectChange(e.target.value)}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} {p.tokenSymbol ? `(${p.tokenSymbol})` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Mensaje de error de carga */}
      {loadError && (
        <div className="sec-market-alert error">
          <AlertCircle size={16} />
          <span>{loadError}</span>
          <button
            type="button"
            onClick={loadData}
            style={{ marginLeft: 'auto', background: 'none', border: 'underline', color: 'inherit', cursor: 'pointer', fontWeight: 600 }}
          >
            Reintentar
          </button>
        </div>
      )}

      {/* ============================================================== */}
      {/* 2. CUADRÍCULA: LIBRO DE ÓRDENES (IZQ) Y FORMULARIO (DER)      */}
      {/* ============================================================== */}
      <div className="sec-market-grid">
        {/* PANEL A: LIBRO DE ÓRDENES */}
        <div className="sec-market-panel">
          <div className="sec-market-panel__header">
            <h2 className="sec-market-panel__title">Libro de órdenes</h2>
            {selectedProject && (
              <span className="sec-market-panel__badge">
                {selectedProject.tokenSymbol || 'TKN'} · {selectedProject.name}
              </span>
            )}
          </div>

          {isLoading ? (
            <div className="sec-market-empty-state">
              Cargando posturas del libro de órdenes...
            </div>
          ) : (
            <div className="sec-market-orderbook-columns">
              {/* Lado izquierdo: Compras (Bid) */}
              <div className="sec-market-book-side">
                <div className="sec-market-book-side__header buy">
                  <span>Compras</span>
                  <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)' }}>
                    {buyOrders.length} {buyOrders.length === 1 ? 'orden' : 'órdenes'}
                  </span>
                </div>

                {buyOrders.length === 0 ? (
                  <div className="sec-market-empty-state">Sin órdenes de compra</div>
                ) : (
                  <table className="sec-market-table">
                    <thead>
                      <tr>
                        <th>Precio (USD)</th>
                        <th>Tokens</th>
                        <th>Total (USD)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {buyOrders.map((ord) => (
                        <tr
                          key={ord.id}
                          className="clickable"
                          onClick={() => handleSelectOrder(ord)}
                          tabIndex={0}
                          role="button"
                          aria-label={`Preparar orden de venta a ${formatUSD(ord.pricePerToken)}`}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleSelectOrder(ord);
                            }
                          }}
                        >
                          <td className="sec-market-price buy">{formatUSD(ord.pricePerToken)}</td>
                          <td>{formatNumber(ord.amountTokens)}</td>
                          <td>{formatUSD(ord.totalValue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Lado derecho: Ventas (Ask) */}
              <div className="sec-market-book-side">
                <div className="sec-market-book-side__header sell">
                  <span>Ventas</span>
                  <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)' }}>
                    {sellOrders.length} {sellOrders.length === 1 ? 'orden' : 'órdenes'}
                  </span>
                </div>

                {sellOrders.length === 0 ? (
                  <div className="sec-market-empty-state">Sin órdenes de venta</div>
                ) : (
                  <table className="sec-market-table">
                    <thead>
                      <tr>
                        <th>Precio (USD)</th>
                        <th>Tokens</th>
                        <th>Total (USD)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sellOrders.map((ord) => (
                        <tr
                          key={ord.id}
                          className="clickable"
                          onClick={() => handleSelectOrder(ord)}
                          tabIndex={0}
                          role="button"
                          aria-label={`Preparar orden de compra a ${formatUSD(ord.pricePerToken)}`}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleSelectOrder(ord);
                            }
                          }}
                        >
                          <td className="sec-market-price sell">{formatUSD(ord.pricePerToken)}</td>
                          <td>{formatNumber(ord.amountTokens)}</td>
                          <td>{formatUSD(ord.totalValue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>

        {/* PANEL B: FORMULARIO DE NUEVA ORDEN */}
        <div className="sec-market-panel">
          <div className="sec-market-panel__header">
            <h2 className="sec-market-panel__title">Nueva orden</h2>
            <span className="sec-market-panel__badge">Precio límite</span>
          </div>

          <form onSubmit={handleCreateOrder} className="sec-market-form">
            {/* 1. Selector Comprar / Vender */}
            <div className="sec-market-segmented" role="tablist" aria-label="Tipo de orden">
              <button
                type="button"
                role="tab"
                aria-selected={orderType === 'buy'}
                className={`sec-market-segment-btn buy ${orderType === 'buy' ? 'active' : ''}`}
                onClick={() => {
                  setOrderType('buy');
                  setActionMessage(null);
                }}
              >
                Comprar
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={orderType === 'sell'}
                className={`sec-market-segment-btn sell ${orderType === 'sell' ? 'active' : ''}`}
                onClick={() => {
                  setOrderType('sell');
                  setActionMessage(null);
                }}
              >
                Vender
              </button>
            </div>

            {/* 2. Referencia breve al proyecto */}
            {selectedProject && (
              <div className="sec-market-project-badge">
                <span>Proyecto:</span>
                <strong>
                  {selectedProject.name} ({selectedProject.tokenSymbol || 'TKN'})
                </strong>
              </div>
            )}

            {/* 3. Precio por token */}
            <div className="sec-market-field">
              <div className="sec-market-field__label-row">
                <label htmlFor="sec-market-price" className="sec-market-field__label">
                  Precio por token
                </label>
                <span className="sec-market-field__help">
                  {orderType === 'buy' ? 'Precio máximo' : 'Precio mínimo'}
                </span>
              </div>
              <div className="sec-market-input-wrapper">
                <span className="sec-market-input-prefix">USD</span>
                <input
                  id="sec-market-price"
                  type="number"
                  step="0.5"
                  min="1"
                  value={pricePerToken}
                  onChange={(e) => setPricePerToken(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="sec-market-input with-prefix"
                  placeholder="100.00"
                  required
                />
              </div>
            </div>

            {/* 4. Cantidad de tokens */}
            <div className="sec-market-field">
              <div className="sec-market-field__label-row">
                <label htmlFor="sec-market-amount" className="sec-market-field__label">
                  Cantidad de tokens
                </label>
              </div>
              <input
                id="sec-market-amount"
                type="number"
                min="1"
                step="1"
                value={amountTokens}
                onChange={(e) => setAmountTokens(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="sec-market-input"
                placeholder="10"
                required
              />
            </div>

            {/* 5. Disponibilidad contextual */}
            <div className="sec-market-availability">
              <span>{orderType === 'buy' ? 'Saldo disponible:' : 'Tokens disponibles:'}</span>
              <strong>
                {orderType === 'buy'
                  ? formatUSD(walletBalance)
                  : `${formatNumber(userTokensInProject)} ${selectedProject?.tokenSymbol || 'TKN'}`}
              </strong>
            </div>

            {/* 6. Resumen consolidado */}
            <div className="sec-market-summary-card">
              <div className="sec-market-summary-row">
                <span>Importe:</span>
                <strong style={{ color: 'var(--text-primary)' }}>{formatUSD(totalEstimatedUSD)}</strong>
              </div>
              <div className="sec-market-summary-row">
                <span>Comisión:</span>
                <span>USD 0,00</span>
              </div>
              <div className="sec-market-summary-row total">
                <span style={{ fontWeight: 600 }}>
                  {orderType === 'buy' ? 'Total estimado:' : 'Neto estimado:'}
                </span>
                <span className="sec-market-summary-total-val">
                  {formatUSD(totalEstimatedUSD)}
                </span>
              </div>
            </div>

            {/* Alertas inline */}
            {actionMessage && (
              <div className={`sec-market-alert ${actionMessage.type}`}>
                {actionMessage.type === 'success' ? (
                  <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
                ) : (
                  <AlertCircle size={16} style={{ flexShrink: 0 }} />
                )}
                <span>{actionMessage.text}</span>
              </div>
            )}

            {/* 7. Acción principal */}
            <button
              type="submit"
              disabled={isSubmitting || amountTokens <= 0 || pricePerToken <= 0}
              className={`sec-market-submit-btn ${orderType}`}
            >
              <span>
                {isSubmitting
                  ? orderType === 'buy'
                    ? 'Publicando compra...'
                    : 'Publicando venta...'
                  : orderType === 'buy'
                  ? 'Publicar compra'
                  : 'Publicar venta'}
              </span>
              <ArrowRight size={16} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
