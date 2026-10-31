import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Coins,
  ArrowRight,
  Wallet,
  Building2,
  Copy,
  Check,
  X,
  CreditCard,
  Clock,
  History,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../../services/api';
import { Investment, LedgerEntry, FiduciaryAccount } from '../../types';
import { useAuth } from '../auth/AuthContext';
import { formatNumber, formatUSD, formatPercent } from '../../utils/formatters';
import './PortfolioPage.css';

interface ConsolidatedPosition {
  projectId: string;
  projectName: string;
  category: string;
  tokenSymbol: string;
  totalTokens: number;
  totalInvestedUSD: number;
  expectedApy: number;
  projectedAnnualYieldUSD: number;
  firstDate: string;
  lastDate: string;
  operationsCount: number;
  rawInvestments: Investment[];
}

export const PortfolioPage: React.FC = () => {
  const { user } = useAuth();
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [fiduciaryAccount, setFiduciaryAccount] = useState<FiduciaryAccount | null>(null);
  const [activeTab, setActiveTab] = useState<'positions' | 'trading' | 'wallet' | 'ledger'>('positions');
  const [loading, setLoading] = useState<boolean>(true);

  // Barra Lateral (Drawer) para Depositar / Retirar
  const [drawerMode, setDrawerMode] = useState<'deposit' | 'withdraw' | null>(null);
  const [depositAmount, setDepositAmount] = useState<number>(1000);
  const [depositMethod, setDepositMethod] = useState<'transfer' | 'crypto'>('transfer');
  const [withdrawAmount, setWithdrawAmount] = useState<number>(500);
  const [withdrawDestination, setWithdrawDestination] = useState<string>('');
  const [isProcessingTx, setIsProcessingTx] = useState<boolean>(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [invs, led, balance, fid] = await Promise.all([
        api.getInvestments(user?.id),
        api.getLedger(user?.id),
        api.getUserBalance(user?.id),
        api.getFiduciaryAccount(),
      ]);
      setInvestments(invs);
      setLedger(led);
      setWalletBalance(balance);
      setFiduciaryAccount(fid);
    } catch (err) {
      console.error('Error cargando cartera:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.id]);

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleConfirmDeposit = async () => {
    if (depositAmount <= 0) return;
    setIsProcessingTx(true);
    try {
      const methodLabel = depositMethod === 'transfer' ? 'Transferencia Bancaria CBU' : 'USDC (Red EVM Sepolia)';
      const newBal = await api.depositFunds(user?.id || 'usr-investor-01', depositAmount, methodLabel);
      setWalletBalance(newBal);
      const updatedLedger = await api.getLedger(user?.id);
      setLedger(updatedLedger);
      setActionSuccessMsg(`Depósito de ${formatUSD(depositAmount)} acreditado.`);
      setTimeout(() => {
        setDrawerMode(null);
        setActionSuccessMsg(null);
      }, 1500);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsProcessingTx(false);
    }
  };

  const handleConfirmWithdraw = async () => {
    if (withdrawAmount <= 0 || withdrawAmount > walletBalance) return;
    setIsProcessingTx(true);
    try {
      const newBal = await api.withdrawFunds(
        user?.id || 'usr-investor-01',
        withdrawAmount,
        withdrawDestination || 'CBU / Wallet Personal'
      );
      setWalletBalance(newBal);
      const updatedLedger = await api.getLedger(user?.id);
      setLedger(updatedLedger);
      setActionSuccessMsg(`Retiro de ${formatUSD(withdrawAmount)} procesado.`);
      setTimeout(() => {
        setDrawerMode(null);
        setActionSuccessMsg(null);
      }, 1500);
    } catch (err: any) {
      alert(err.message || 'Error al procesar retiro');
    } finally {
      setIsProcessingTx(false);
    }
  };

  // 1. Consolidación de activos por obra:
  // Agrupa compras del mismo proyecto para no mostrar operaciones repetidas.
  const consolidatedPositions = useMemo<ConsolidatedPosition[]>(() => {
    const map = new Map<string, ConsolidatedPosition>();

    for (const inv of investments) {
      const key = inv.projectId || inv.projectName;
      const existing = map.get(key);

      if (!existing) {
        const annualYield = inv.amount * ((inv.expectedApy || 12.0) / 100);
        map.set(key, {
          projectId: inv.projectId,
          projectName: inv.projectName,
          category: inv.category || 'Residencial',
          tokenSymbol: inv.tokenSymbol || 'TKN',
          totalTokens: inv.tokens,
          totalInvestedUSD: inv.amount,
          expectedApy: inv.expectedApy || 12.0,
          projectedAnnualYieldUSD: annualYield,
          firstDate: inv.date,
          lastDate: inv.date,
          operationsCount: 1,
          rawInvestments: [inv],
        });
      } else {
        existing.totalTokens += inv.tokens;
        existing.totalInvestedUSD += inv.amount;
        existing.operationsCount += 1;
        existing.rawInvestments.push(inv);

        const totalYield = existing.rawInvestments.reduce(
          (acc, i) => acc + (i.amount * ((i.expectedApy || 12.0) / 100)),
          0
        );
        existing.projectedAnnualYieldUSD = totalYield;
        existing.expectedApy = existing.totalInvestedUSD > 0
          ? (totalYield / existing.totalInvestedUSD) * 100
          : 12.0;

        if (inv.date > existing.lastDate) existing.lastDate = inv.date;
        if (inv.date < existing.firstDate) existing.firstDate = inv.date;
      }
    }

    return Array.from(map.values());
  }, [investments]);

  const totalInvested = consolidatedPositions.reduce((acc, p) => acc + p.totalInvestedUSD, 0);
  const estimatedAnnualYield = consolidatedPositions.reduce((acc, p) => acc + p.projectedAnnualYieldUSD, 0);
  const estimatedMonthlyYield = estimatedAnnualYield / 12;

  // 2. Gráfica circular de distribución (Donut Chart)
  // Paleta fintech institucional neutra de activos (evita el verde/rojo para no colisionar con P&L)
  const donutData = useMemo(() => {
    if (consolidatedPositions.length === 0 || totalInvested === 0) return [];
    const colors = [
      '#3b82f6', // 1. Azul Zafiro / Royal Slate
      '#d97706', // 2. Dorado Solar / Ámbar Cálido
      '#0d9488', // 3. Teal / Petróleo Profundo
      '#ea580c', // 4. Terracota / Ladrillo Noble
      '#8b5cf6', // 5. Índigo / Amatista Atenuado
      '#64748b', // 6. Pizarra / Slate Acero
    ];
    const circumference = 2 * Math.PI * 48; // r = 48 -> ~301.59
    let accumulatedPercent = 0;

    return consolidatedPositions.map((pos, idx) => {
      const percent = (pos.totalInvestedUSD / totalInvested) * 100;
      const strokeLength = Math.max(0, (percent / 100) * circumference - 2);
      const strokeOffset = (accumulatedPercent / 100) * circumference;
      accumulatedPercent += percent;

      return {
        key: pos.projectId,
        name: pos.projectName,
        amount: pos.totalInvestedUSD,
        percent,
        color: colors[idx % colors.length],
        strokeLength,
        strokeOffset,
      };
    });
  }, [consolidatedPositions, totalInvested]);

  if (loading) {
    return (
      <div className="portfolio-root" style={{ textAlign: 'center', padding: '100px 0' }}>
        <Coins size={36} className="spin" style={{ margin: '0 auto 16px', opacity: 0.5 }} />
        <p style={{ color: 'var(--text-muted)', fontSize: '15px' }}>
          Cargando datos del portafolio...
        </p>
      </div>
    );
  }

  return (
    <div className="portfolio-root">
      {/* ============================================================== */}
      {/* 1. ENCABEZADO LIMPIO: Título y acciones Depositar / Retirar    */}
      {/* ============================================================== */}
      <div className="portfolio-header">
        <h1 className="portfolio-title">Mi portafolio</h1>

        <div className="portfolio-header__actions">
          <button
            type="button"
            className="portfolio-btn portfolio-btn--primary"
            onClick={() => setDrawerMode('deposit')}
          >
            Depositar
          </button>

          <button
            type="button"
            className="portfolio-btn portfolio-btn--secondary"
            onClick={() => setDrawerMode('withdraw')}
            disabled={walletBalance <= 0}
            title={walletBalance <= 0 ? 'Sin saldo disponible para retirar' : 'Extraer fondos a tu cuenta'}
          >
            Retirar
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. CUATRO INDICADORES FÁCILES DE COMPARAR (KPIS)               */}
      {/* ============================================================== */}
      <div className="portfolio-kpi-grid">
        {/* KPI 1: Total invertido */}
        <div className="portfolio-kpi-card">
          <span className="portfolio-kpi-label">Total invertido</span>
          <div className="portfolio-kpi-value">{formatUSD(totalInvested)}</div>
          <span className="portfolio-kpi-subtext">Capital en cuotapartes activas</span>
        </div>

        {/* KPI 2: Saldo disponible (con tratamiento diferenciado ante saldo negativo) */}
        <div className="portfolio-kpi-card">
          <span className="portfolio-kpi-label">
            <span>{walletBalance < 0 ? 'Saldo pendiente' : 'Saldo disponible'}</span>
            <span
              className={`portfolio-kpi-badge ${walletBalance < 0 ? 'warning' : 'available'}`}
            >
              {walletBalance < 0 ? 'Descubierto' : 'Disponible'}
            </span>
          </span>
          <div className={`portfolio-kpi-value ${walletBalance < 0 ? 'negative' : ''}`}>
            {formatUSD(walletBalance)}
          </div>
          <span className="portfolio-kpi-subtext">
            {walletBalance < 0
              ? 'Pendiente de regularizar mediante depósito'
              : 'Listo para operar o transferir'}
          </span>
        </div>

        {/* KPI 3: Proyectos */}
        <div className="portfolio-kpi-card">
          <span className="portfolio-kpi-label">Proyectos</span>
          <div className="portfolio-kpi-value">{consolidatedPositions.length}</div>
          <span className="portfolio-kpi-subtext">Con participación activa</span>
        </div>

        {/* KPI 4: Ingreso mensual estimado */}
        <div className="portfolio-kpi-card">
          <span className="portfolio-kpi-label">Ingreso mensual estimado</span>
          <div className="portfolio-kpi-value">
            +{formatUSD(estimatedMonthlyYield)}
          </div>
          <span className="portfolio-kpi-subtext">
            Proyección anual: +{formatUSD(estimatedAnnualYield)}
          </span>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 3. DISTRIBUCIÓN DE INVERSIONES (GRÁFICA CIRCULAR CON LISTA)    */}
      {/* ============================================================== */}
      {consolidatedPositions.length > 0 && (
        <div className="portfolio-diversification-card">
          <h2 className="portfolio-card-title">Distribución de inversiones</h2>

          <div className="portfolio-donut-layout">
            {/* Gráfico Donut SVG */}
            <div className="portfolio-donut-wrapper">
              <svg className="portfolio-donut-svg" viewBox="0 0 120 120">
                <circle
                  cx="60"
                  cy="60"
                  r="48"
                  fill="none"
                  stroke="var(--color-surface-raised)"
                  strokeWidth="14"
                />
                {donutData.map((slice) => (
                  <circle
                    key={slice.key}
                    cx="60"
                    cy="60"
                    r="48"
                    fill="none"
                    stroke={slice.color}
                    strokeWidth="14"
                    strokeDasharray={`${slice.strokeLength} 301.59`}
                    strokeDashoffset={`-${slice.strokeOffset}`}
                    strokeLinecap="round"
                    style={{ transition: 'all 400ms ease' }}
                  />
                ))}
              </svg>
              <div className="portfolio-donut-center">
                <span className="portfolio-donut-center__label">Invertido</span>
                <span className="portfolio-donut-center__value">{formatUSD(totalInvested)}</span>
              </div>
            </div>

            {/* Leyenda simple y alineada: Proyecto — Monto invertido — Porcentaje */}
            <div className="portfolio-donut-list">
              {donutData.map((item) => (
                <div key={item.key} className="portfolio-donut-row">
                  <div className="portfolio-donut-row__left">
                    <span className="portfolio-donut-dot" style={{ background: item.color }} />
                    <span className="portfolio-donut-row__name">{item.name}</span>
                  </div>
                  <div className="portfolio-donut-row__right">
                    <span className="portfolio-donut-row__amount">{formatUSD(item.amount)}</span>
                    <span className="portfolio-donut-row__sep">·</span>
                    <span className="portfolio-donut-row__percent">{formatPercent(item.percent)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 4. PESTAÑAS DE NAVEGACIÓN SIMPLIFICADAS                        */}
      {/* ============================================================== */}
      <div>
        <div className="portfolio-tabs">
          <button
            type="button"
            className={`portfolio-tab-btn ${activeTab === 'positions' ? 'active' : ''}`}
            onClick={() => setActiveTab('positions')}
          >
            <Building2 size={15} />
            <span>Inversiones ({consolidatedPositions.length})</span>
          </button>

          <button
            type="button"
            className={`portfolio-tab-btn ${activeTab === 'trading' ? 'active' : ''}`}
            onClick={() => setActiveTab('trading')}
          >
            <History size={15} />
            <span>Movimientos ({investments.length})</span>
          </button>

          <button
            type="button"
            className={`portfolio-tab-btn ${activeTab === 'wallet' ? 'active' : ''}`}
            onClick={() => setActiveTab('wallet')}
          >
            <Wallet size={15} />
            <span>Billetera ({formatUSD(walletBalance)})</span>
          </button>

          <button
            type="button"
            className={`portfolio-tab-btn ${activeTab === 'ledger' ? 'active' : ''}`}
            onClick={() => setActiveTab('ledger')}
          >
            <Clock size={15} />
            <span>Registro de operaciones ({ledger.length})</span>
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* TAB 1: INVERSIONES (TABLA LIMPIA Y DESPEJADA)                   */}
      {/* ============================================================== */}
      {activeTab === 'positions' && (
        <div className="portfolio-table-card">
          {consolidatedPositions.length === 0 ? (
            <div style={{ padding: '56px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Coins size={44} style={{ margin: '0 auto 14px', opacity: 0.35 }} />
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 6px' }}>
                No tenés inversiones activas
              </h3>
              <p style={{ fontSize: '13.5px', maxWidth: '440px', margin: '0 auto', lineHeight: 1.5 }}>
                Al participar en proyectos, tus inversiones se reflejarán de forma consolidada aquí.
              </p>
            </div>
          ) : (
            <div className="portfolio-table-container">
              <table className="portfolio-table">
                <thead>
                  <tr>
                    <th>Proyecto</th>
                    <th style={{ textAlign: 'right' }}>Tokens</th>
                    <th style={{ textAlign: 'right' }}>Invertido</th>
                    <th style={{ textAlign: 'right' }}>% de cartera</th>
                    <th style={{ textAlign: 'right' }}>Ingreso anual estimado</th>
                    <th style={{ textAlign: 'right' }}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {consolidatedPositions.map((pos) => {
                    const portfolioShare = totalInvested > 0 ? (pos.totalInvestedUSD / totalInvested) * 100 : 0;
                    return (
                      <tr key={pos.projectId}>
                        <td>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            {pos.projectName}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 500 }}>
                          {formatNumber(pos.totalTokens)}{' '}
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{pos.tokenSymbol}</span>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          {formatUSD(pos.totalInvestedUSD)}
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--text-muted)', fontWeight: 500 }}>
                          {formatPercent(portfolioShare)}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span style={{ fontWeight: 600 }}>
                            +{formatUSD(pos.projectedAnnualYieldUSD)}
                          </span>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '6px' }}>
                            ({pos.expectedApy.toFixed(1)}%)
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <Link
                            to={`/app/projects/${pos.projectId}`}
                            className="portfolio-btn portfolio-btn--secondary portfolio-btn--sm"
                          >
                            <span>Ver inversión</span>
                            <ArrowRight size={13} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: MOVIMIENTOS (HISTORIAL DE COMPRAS Y VENTAS)             */}
      {/* ============================================================== */}
      {activeTab === 'trading' && (
        <div className="portfolio-table-card">
          {investments.length === 0 ? (
            <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <History size={40} style={{ margin: '0 auto 12px', opacity: 0.35 }} />
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 6px' }}>
                Sin movimientos registrados
              </h3>
              <p style={{ fontSize: '13px', maxWidth: '420px', margin: '0 auto' }}>
                Las compras y ventas de participaciones se registrarán cronológicamente aquí.
              </p>
            </div>
          ) : (
            <div className="portfolio-table-container">
              <table className="portfolio-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>Proyecto</th>
                    <th style={{ textAlign: 'right' }}>Tokens</th>
                    <th style={{ textAlign: 'right' }}>Precio unitario</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                    <th style={{ textAlign: 'right' }}>Comprobante</th>
                  </tr>
                </thead>
                <tbody>
                  {investments.map((inv) => (
                    <tr key={inv.id}>
                      <td style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{inv.date}</td>
                      <td>
                        <span style={{ fontWeight: 600, fontSize: '12.5px' }}>
                          Compra
                        </span>
                      </td>
                      <td>
                        <strong style={{ color: 'var(--text-primary)' }}>{inv.projectName}</strong>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 500 }}>
                        {formatNumber(inv.tokens)} {inv.tokenSymbol || 'TKN'}
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                        {formatUSD(inv.tokens > 0 ? inv.amount / inv.tokens : 100)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {formatUSD(inv.amount)}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                          {inv.simulatedTxHash || '0x71f4...b29c'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 3: BILLETERA                                              */}
      {/* ============================================================== */}
      {activeTab === 'wallet' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div
            className="portfolio-table-card"
            style={{
              padding: '28px',
              background: 'linear-gradient(135deg, rgba(24, 24, 27, 0.95) 0%, rgba(18, 18, 21, 0.95) 100%)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px' }}>
              <div>
                <span className="portfolio-kpi-label" style={{ marginBottom: '8px' }}>Saldo en cuenta</span>
                <div className={`portfolio-kpi-value ${walletBalance < 0 ? 'negative' : ''}`} style={{ fontSize: '36px' }}>
                  {formatUSD(walletBalance)}
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '13.5px', margin: '8px 0 0 0', maxWidth: '520px' }}>
                  {walletBalance < 0
                    ? 'Saldo deudor pendiente de regularizar mediante depósito para habilitar nuevas operaciones.'
                    : 'Fondos disponibles para suscribir cuotapartes o transferir a tu cuenta bancaria.'}
                </p>
              </div>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button
                  type="button"
                  className="portfolio-btn portfolio-btn--primary"
                  onClick={() => setDrawerMode('deposit')}
                >
                  Depositar
                </button>

                <button
                  type="button"
                  className="portfolio-btn portfolio-btn--secondary"
                  onClick={() => setDrawerMode('withdraw')}
                  disabled={walletBalance <= 0}
                >
                  Retirar
                </button>
              </div>
            </div>
          </div>

          {/* Rieles de pago CBU y USDC */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            <div className="portfolio-table-card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <CreditCard size={18} style={{ color: '#3b82f6' }} />
                <h3 style={{ fontSize: '15px', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
                  Transferencia bancaria
                </h3>
              </div>

              <div style={{ display: 'grid', gap: '10px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--color-surface-raised)', borderRadius: '8px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Banco:</span>
                  <strong>{fiduciaryAccount?.bankName || 'Cargando...'}</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--color-surface-raised)', borderRadius: '8px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Titular:</span>
                  <strong>{fiduciaryAccount?.accountHolder || 'Cargando...'}</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--color-surface-raised)', borderRadius: '8px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>CUIT:</span>
                  <strong>{fiduciaryAccount?.cuit || '—'}</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--color-surface-raised)', borderRadius: '8px' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '11px' }}>Alias:</span>
                    <strong>{fiduciaryAccount?.alias || '—'}</strong>
                  </div>
                  <button
                    type="button"
                    onClick={() => fiduciaryAccount?.alias && handleCopy(fiduciaryAccount.alias, 'alias')}
                    className="portfolio-btn portfolio-btn--secondary portfolio-btn--sm"
                  >
                    {copiedField === 'alias' ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                    <span>{copiedField === 'alias' ? 'Copiado' : 'Copiar'}</span>
                  </button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--color-surface-raised)', borderRadius: '8px' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '11px' }}>CBU:</span>
                    <strong style={{ fontSize: '12px' }}>{fiduciaryAccount?.cbu || '—'}</strong>
                  </div>
                  <button
                    type="button"
                    onClick={() => fiduciaryAccount?.cbu && handleCopy(fiduciaryAccount.cbu, 'cbu')}
                    className="portfolio-btn portfolio-btn--secondary portfolio-btn--sm"
                  >
                    {copiedField === 'cbu' ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                    <span>{copiedField === 'cbu' ? 'Copiado' : 'Copiar'}</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="portfolio-table-card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <ShieldCheck size={18} style={{ color: '#10b981' }} />
                <h3 style={{ fontSize: '15px', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
                  Depósito USDC (Cripto)
                </h3>
              </div>

              <div style={{ display: 'grid', gap: '10px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--color-surface-raised)', borderRadius: '8px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Token:</span>
                  <strong>USDC</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--color-surface-raised)', borderRadius: '8px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Redes:</span>
                  <strong>Ethereum Sepolia / Polygon</strong>
                </div>

                <div style={{ padding: '12px', background: 'var(--color-surface-raised)', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Dirección de bóveda:</span>
                    <button
                      type="button"
                      onClick={() => fiduciaryAccount?.cryptoVaultAddress && handleCopy(fiduciaryAccount.cryptoVaultAddress, 'crypto')}
                      className="portfolio-btn portfolio-btn--secondary portfolio-btn--sm"
                    >
                      {copiedField === 'crypto' ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                      <span>{copiedField === 'crypto' ? 'Copiada' : 'Copiar'}</span>
                    </button>
                  </div>
                  <div style={{ fontSize: '11.5px', wordBreak: 'break-all', fontFamily: 'monospace' }}>
                    {fiduciaryAccount?.cryptoVaultAddress || '—'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 4: REGISTRO DE OPERACIONES                                */}
      {/* ============================================================== */}
      {activeTab === 'ledger' && (
        <div className="portfolio-table-card">
          {ledger.length === 0 ? (
            <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <History size={40} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 6px' }}>
                Sin registros contables
              </h3>
              <p style={{ fontSize: '13px', maxWidth: '420px', margin: '0 auto' }}>
                Los asientos de doble partida se registrarán automáticamente aquí.
              </p>
            </div>
          ) : (
            <div className="portfolio-table-container">
              <table className="portfolio-table">
                <thead>
                  <tr>
                    <th>Fecha & hora</th>
                    <th>Tipo</th>
                    <th>Descripción</th>
                    <th>Referencia</th>
                    <th style={{ textAlign: 'right' }}>Monto</th>
                    <th style={{ textAlign: 'right' }}>Saldo resultante</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((entry) => {
                    const isCredit = entry.amount > 0;
                    return (
                      <tr key={entry.id}>
                        <td style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{entry.timestamp}</td>
                        <td style={{ fontWeight: 500 }}>
                          {entry.type}
                        </td>
                        <td style={{ color: 'var(--text-primary)' }}>{entry.description}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                          {entry.referenceId}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          {isCredit ? '+' : ''}{formatUSD(entry.amount)}
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                          {formatUSD(entry.balanceAfter)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* 5. BARRA LATERAL (DRAWER) PARA DEPOSITAR Y RETIRAR              */}
      {/* ============================================================== */}
      {drawerMode !== null && (
        <div className="portfolio-drawer-backdrop" onClick={() => setDrawerMode(null)}>
          <div className="portfolio-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="portfolio-drawer__header">
              <h3 className="portfolio-drawer__title">
                {drawerMode === 'deposit' ? 'Depositar' : 'Retirar'}
              </h3>
              <button
                type="button"
                className="portfolio-drawer__close"
                onClick={() => setDrawerMode(null)}
                aria-label="Cerrar barra lateral"
              >
                <X size={18} />
              </button>
            </div>

            <div className="portfolio-drawer__tabs">
              <button
                type="button"
                className={`portfolio-drawer__tab-btn ${drawerMode === 'deposit' ? 'active' : ''}`}
                onClick={() => setDrawerMode('deposit')}
              >
                Depositar
              </button>
              <button
                type="button"
                className={`portfolio-drawer__tab-btn ${drawerMode === 'withdraw' ? 'active' : ''}`}
                onClick={() => setDrawerMode('withdraw')}
              >
                Retirar
              </button>
            </div>

            <div className="portfolio-drawer__content">
              {drawerMode === 'deposit' ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setDepositMethod('transfer')}
                      className={`portfolio-btn ${depositMethod === 'transfer' ? 'portfolio-btn--primary' : 'portfolio-btn--secondary'}`}
                      style={{ justifyContent: 'center' }}
                    >
                      Transferencia CBU
                    </button>
                    <button
                      type="button"
                      onClick={() => setDepositMethod('crypto')}
                      className={`portfolio-btn ${depositMethod === 'crypto' ? 'portfolio-btn--primary' : 'portfolio-btn--secondary'}`}
                      style={{ justifyContent: 'center' }}
                    >
                      USDC (Cripto)
                    </button>
                  </div>

                  {depositMethod === 'transfer' ? (
                    <div style={{ padding: '14px', background: 'var(--color-surface-raised)', borderRadius: '12px', border: '1px solid var(--surface-glass-border)', display: 'grid', gap: '8px', fontSize: '13px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Banco:</span>
                        <strong>{fiduciaryAccount?.bankName}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Alias:</span>
                        <strong>{fiduciaryAccount?.alias}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>CBU:</span>
                        <strong style={{ fontSize: '11.5px' }}>{fiduciaryAccount?.cbu}</strong>
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: '14px', background: 'var(--color-surface-raised)', borderRadius: '12px', border: '1px solid var(--surface-glass-border)', fontSize: '12.5px' }}>
                      <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Dirección de bóveda:</span>
                      <strong style={{ fontFamily: 'monospace', wordBreak: 'break-all', fontSize: '11.5px', display: 'block' }}>
                        {fiduciaryAccount?.cryptoVaultAddress}
                      </strong>
                    </div>
                  )}

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '8px' }}>
                      Monto sugerido (USD):
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                      {[500, 1000, 2500, 5000].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setDepositAmount(amt)}
                          className={`portfolio-btn ${depositAmount === amt ? 'portfolio-btn--primary' : 'portfolio-btn--secondary'}`}
                          style={{ justifyContent: 'center', padding: '8px 4px', fontSize: '13px' }}
                        >
                          ${amt}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '6px' }}>
                      Monto a ingresar en USD:
                    </label>
                    <input
                      type="number"
                      min="50"
                      step="50"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                      style={{
                        width: '100%',
                        padding: '12px 14px',
                        borderRadius: '10px',
                        background: 'var(--color-surface-raised)',
                        border: '1px solid var(--surface-glass-border)',
                        color: 'var(--text-primary)',
                        fontSize: '16px',
                        fontWeight: 600,
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div style={{ padding: '16px', background: 'var(--color-surface-raised)', borderRadius: '12px', border: '1px solid var(--surface-glass-border)' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block' }}>Saldo disponible:</span>
                    <strong style={{ fontSize: '24px', display: 'block', marginTop: '4px' }}>
                      {formatUSD(walletBalance)}
                    </strong>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '6px' }}>
                      Monto a extraer en USD:
                    </label>
                    <input
                      type="number"
                      min="10"
                      max={walletBalance > 0 ? walletBalance : 0}
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(Math.min(walletBalance, Math.max(0, parseFloat(e.target.value) || 0)))}
                      style={{
                        width: '100%',
                        padding: '12px 14px',
                        borderRadius: '10px',
                        background: 'var(--color-surface-raised)',
                        border: '1px solid var(--surface-glass-border)',
                        color: 'var(--text-primary)',
                        fontSize: '16px',
                        fontWeight: 600,
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '6px' }}>
                      CBU o dirección de destino:
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. 0720... o ALIAS.MIO"
                      value={withdrawDestination}
                      onChange={(e) => setWithdrawDestination(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px 14px',
                        borderRadius: '10px',
                        background: 'var(--color-surface-raised)',
                        border: '1px solid var(--surface-glass-border)',
                        color: 'var(--text-primary)',
                        fontSize: '13.5px',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </>
              )}

              {actionSuccessMsg && (
                <div style={{ padding: '12px', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '10px', color: '#10b981', textAlign: 'center', fontSize: '13px', fontWeight: 600 }}>
                  {actionSuccessMsg}
                </div>
              )}
            </div>

            <div className="portfolio-drawer__footer">
              {drawerMode === 'deposit' ? (
                <button
                  type="button"
                  className="portfolio-btn portfolio-btn--primary"
                  onClick={handleConfirmDeposit}
                  disabled={isProcessingTx || depositAmount <= 0}
                  style={{ width: '100%', justifyContent: 'center', height: '46px' }}
                >
                  {isProcessingTx ? 'Confirmando...' : `Confirmar ingreso de ${formatUSD(depositAmount)}`}
                </button>
              ) : (
                <button
                  type="button"
                  className="portfolio-btn portfolio-btn--primary"
                  onClick={handleConfirmWithdraw}
                  disabled={isProcessingTx || withdrawAmount <= 0 || withdrawAmount > walletBalance}
                  style={{ width: '100%', justifyContent: 'center', height: '46px' }}
                >
                  {isProcessingTx ? 'Procesando...' : `Solicitar retiro de ${formatUSD(withdrawAmount)}`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
