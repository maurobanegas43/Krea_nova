import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Building2, ShieldCheck, Wallet } from 'lucide-react';
import { api } from '../../services/api';
import { Project, LedgerEntry } from '../../types';

export const DashboardPage: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getProjects(), api.getLedger()]).then(([pList, lList]) => {
      setProjects(pList);
      setLedger(lList);
      setLoading(false);
    });
  }, []);

  const totalFunded = projects.reduce((acc, p) => acc + p.fundsRaised, 0) / 100;
  const activeOpportunities = projects.filter((p) => p.status === 'published');
  const avgApy =
    projects.length > 0
      ? (projects.reduce((acc, p) => acc + (p.expectedApy || 12), 0) / projects.length).toFixed(1)
      : '0.0';

  if (loading) {
    return <div className="empty">Cargando métricas de la plataforma...</div>;
  }

  return (
    <div className="stack">
      {/* Header */}
      <div className="page-header">
        <div className="page-header__text">
          <span className="eyebrow">Resumen Institucional</span>
          <h1>Plataforma de Financiamiento</h1>
          <p>
            Trazabilidad integral de activos inmobiliarios respaldados por instrumentos jurídicos y
            representación tokenizada en red de prueba EVM.
          </p>
        </div>
        <div className="row">
          <Link to="/app/projects" className="btn btn--primary">
            Explorar Activos
            <ArrowUpRight size={16} />
          </Link>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="card">
        <div className="grid-stats">
          <div className="stat">
            <span className="eyebrow">Capital Fondeado</span>
            <div className="stat__value num">${totalFunded.toLocaleString('es-AR')}</div>
            <div className="stat__delta">
              <span className="subtle">
                En {activeOpportunities.length} {activeOpportunities.length === 1 ? 'desarrollo activo' : 'desarrollos activos'}
              </span>
            </div>
          </div>
          <div className="stat">
            <span className="eyebrow">Rentabilidad Media Proyectada</span>
            <div className="stat__value num">{avgApy}% APY</div>
            <div className="stat__delta">
              <span className="subtle">Renta trimestral estimada</span>
            </div>
          </div>
          <div className="stat">
            <span className="eyebrow">Inversión Mínima</span>
            <div className="stat__value num">$500 USD</div>
            <div className="stat__delta">
              <span className="subtle">Ticket accesible fraccionado</span>
            </div>
          </div>
          <div className="stat">
            <span className="eyebrow">Seguridad & Auditoría</span>
            <div className="stat__value num">Partida Doble</div>
            <div className="stat__delta">
              <span className="subtle">Hexagonal + Libro Mayor</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Projects & Ledger */}
      <div className="grid-2-1">
        {/* Projects Column */}
        <div className="stack">
          <div className="card">
            <div className="card__header">
              <div className="row">
                <Building2 size={18} className="muted" />
                <h2 className="card__title">Oportunidades Destacadas</h2>
              </div>
              <Link to="/app/projects" className="btn btn--ghost btn--sm">
                Ver todos ({projects.length})
              </Link>
            </div>
            <div className="card__body" style={{ display: 'grid', gap: 'var(--space-5)' }}>
              {activeOpportunities.slice(0, 3).map((p) => {
                const goalUSD = p.fundingGoal / 100;
                const raisedUSD = p.fundsRaised / 100;

                return (
                  <div
                    key={p.id}
                    className="card card--interactive"
                    style={{ padding: 'var(--space-4)', background: 'var(--color-surface-raised)' }}
                  >
                    <div className="row row--between" style={{ marginBottom: 'var(--space-2)' }}>
                      <div>
                        <div className="row" style={{ gap: '8px' }}>
                          <h3 style={{ fontSize: 'var(--text-md)' }}>{p.name}</h3>
                          <span className="badge badge--strong mono">{p.tokenSymbol}</span>
                        </div>
                        <span className="subtle" style={{ fontSize: 'var(--text-xs)' }}>
                          {p.location}
                        </span>
                      </div>
                      <span className="badge badge--solid">{p.expectedApy}% APY</span>
                    </div>

                    <p className="muted" style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--space-3)' }}>
                      {p.description}
                    </p>

                    <div className="progress" style={{ marginBottom: 'var(--space-3)' }}>
                      <div className="progress__track">
                        <div
                          className="progress__fill"
                          style={{ width: `${Math.min(p.fundedPercent, 100)}%` }}
                        />
                      </div>
                      <div className="progress__meta num">
                        <span>
                          Fondeado: <strong>${raisedUSD.toLocaleString()}</strong> de ${goalUSD.toLocaleString()}
                        </span>
                        <span>{p.fundedPercent}%</span>
                      </div>
                    </div>

                    <div className="row row--between" style={{ paddingTop: 'var(--space-2)', borderTop: '1px solid var(--color-border)' }}>
                      <span className="subtle" style={{ fontSize: 'var(--text-xs)' }}>
                        Avance de obra declarado: <strong>{p.progress}%</strong>
                      </span>
                      <Link to={`/app/projects/${p.id}`} className="btn btn--secondary btn--sm">
                        Ver Oportunidad
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sidebar Column: Ledger & Architecture status */}
        <div className="stack">
          {/* Architectural highlights */}
          <div className="card">
            <div className="card__header">
              <div className="row">
                <ShieldCheck size={18} className="muted" />
                <h2 className="card__title">Arquitectura Hexagonal</h2>
              </div>
            </div>
            <div className="card__body" style={{ display: 'grid', gap: 'var(--space-3)', fontSize: 'var(--text-xs)' }}>
              <div className="row row--between">
                <span className="muted">Núcleo Dominio</span>
                <span className="badge badge--strong mono">Puro Go (Sin frameworks)</span>
              </div>
              <div className="row row--between">
                <span className="muted">Persistencia Principal</span>
                <span className="badge badge--strong mono">PostgreSQL (Ledger / ACID)</span>
              </div>
              <div className="row row--between">
                <span className="muted">Documentos / Due Diligence</span>
                <span className="badge badge--strong mono">MongoDB (Estructura variable)</span>
              </div>
              <div className="row row--between">
                <span className="muted">Representación de Activos</span>
                <span className="badge badge--strong mono">EVM Smart Contracts</span>
              </div>
              <div className="row row--between">
                <span className="muted">Mercado Secundario</span>
                <span className="badge badge--strong mono">Off-chain matching</span>
              </div>
            </div>
          </div>

          {/* Ledger feed */}
          <div className="card">
            <div className="card__header">
              <div className="row">
                <Wallet size={18} className="muted" />
                <h2 className="card__title">Últimos Asientos Ledger</h2>
              </div>
              <Link to="/app/portfolio" className="btn btn--ghost btn--sm">
                Historial
              </Link>
            </div>
            <div className="card__body" style={{ padding: 0 }}>
              {ledger.length === 0 ? (
                <div style={{ padding: 'var(--space-5)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>
                  Sin movimientos contables registrados aún
                </div>
              ) : (
                <div style={{ display: 'grid' }}>
                  {ledger.slice(0, 4).map((entry) => {
                  const isPositive = entry.amount > 0;
                  return (
                    <div
                      key={entry.id}
                      style={{
                        padding: 'var(--space-3) var(--space-5)',
                        borderBottom: '1px solid var(--color-border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'grid', gap: '2px' }}>
                        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 500 }}>
                          {entry.description}
                        </span>
                        <span className="subtle mono" style={{ fontSize: '10px' }}>
                          {entry.referenceId}
                        </span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div
                          className="num"
                          style={{
                            fontSize: 'var(--text-sm)',
                            fontWeight: 600,
                            color: isPositive ? 'var(--color-text)' : 'var(--color-text-muted)',
                          }}
                        >
                          {isPositive ? '+' : ''}${Math.abs(entry.amount).toLocaleString('es-AR')}
                        </div>
                        <span className="subtle" style={{ fontSize: '10px' }}>
                          {entry.timestamp.split(' ')[0]}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
