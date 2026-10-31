import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  MapPin,
  Building2,
  ShieldCheck,
  Camera,
  Maximize2,
  X,
  ChevronLeft,
  ChevronRight,
  FileDown,
  Ruler,
  DollarSign,
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  Minus,
  Sparkles,
  FileText,
} from 'lucide-react';
import { api } from '../../services/api';
import { Project, DeveloperProfile, ProjectImage, Investment } from '../../types';
import { generateProjectAuditPDF } from '../../services/pdfGenerator';
import { useAuth } from '../auth/AuthContext';
import { formatNumber, formatUSD, formatPercent } from '../../utils/formatters';
import './ProjectDetailPage.css';

export const ProjectDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [developer, setDeveloper] = useState<DeveloperProfile | null>(null);
  const [activePhotoIndex, setActivePhotoIndex] = useState<number>(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'tracking' | 'budget' | 'architecture' | 'legal'>('tracking');
  const [budgetSubTab, setBudgetSubTab] = useState<'materials' | 'payroll' | 'equipment' | 'summary'>('materials');
  const [isGeneratingPDF, setIsGeneratingPDF] = useState<boolean>(false);

  // Token Acquisition State
  const [tokensToBuy, setTokensToBuy] = useState<number>(10);
  const [isBuying, setIsBuying] = useState<boolean>(false);
  const [buyError, setBuyError] = useState<string | null>(null);
  const [purchaseSuccess, setPurchaseSuccess] = useState<Investment | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    if (id) {
      api.getProject(id).then((p) => {
        setProject(p || null);
        if (p?.developerId) {
          api.getDeveloper(p.developerId).then((dev) => setDeveloper(dev || null));
        }
      });
    }
  }, [id]);

  if (!project) {
    return (
      <div className="pdetail-root" style={{ padding: '80px 20px', textAlign: 'center' }}>
        <h2 style={{ fontSize: '20px', marginBottom: '8px', color: 'var(--text-primary)' }}>
          Proyecto no encontrado
        </h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>
          No pudimos localizar la información del desarrollo solicitado.
        </p>
        <Link to="/app/projects" className="btn btn--secondary">
          Volver al catálogo
        </Link>
      </div>
    );
  }

  const images: ProjectImage[] =
    project.images && project.images.length > 0
      ? project.images
      : [
          {
            url:
              project.imageUrl ||
              'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80',
            caption: 'Fachada y Render Arquitectónico Principal',
            category: 'render',
          },
        ];

  const activeImage = images[activePhotoIndex] || images[0];

  const handleNextPhoto = () => {
    setActivePhotoIndex((prev) => (prev + 1) % images.length);
  };

  const handlePrevPhoto = () => {
    setActivePhotoIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const handleDownloadPDF = () => {
    setIsGeneratingPDF(true);
    setTimeout(() => {
      try {
        generateProjectAuditPDF(project, developer);
      } finally {
        setIsGeneratingPDF(false);
      }
    }, 400);
  };

  // Fixed Token Economics: $100 USD per token
  const TOKEN_PRICE_USD = 100;
  const totalGoalUSD = project.fundingGoal ? project.fundingGoal / 100 : 1200000;
  const currentRaisedUSD = project.fundsRaised ? project.fundsRaised / 100 : 0;
  const totalTokenSupply = Math.max(1, Math.floor(totalGoalUSD / TOKEN_PRICE_USD));
  const tokensSold = Math.floor(currentRaisedUSD / TOKEN_PRICE_USD);
  const tokensAvailable = Math.max(0, totalTokenSupply - tokensSold);
  const tokenSymbol =
    project.tokenSymbol ||
    (project.name ? project.name.substring(0, 4).toUpperCase() + '-01' : 'TKN-01');

  const handleBuyTokens = async () => {
    if (!user) return;
    if (tokensToBuy < 1) {
      setBuyError('Debés ingresar al menos 1 token para adquirir.');
      return;
    }
    if (tokensAvailable > 0 && tokensToBuy > tokensAvailable) {
      setBuyError(`Solo quedan ${formatNumber(tokensAvailable)} tokens disponibles.`);
      return;
    }
    setIsBuying(true);
    setBuyError(null);
    try {
      const inv = await api.buyProjectTokens(project.id, tokensToBuy, user.id);
      setPurchaseSuccess(inv);
      const updated = await api.getProject(project.id);
      if (updated) {
        setProject(updated);
      }
    } catch (err: any) {
      setBuyError(err.message || 'Error al procesar la adquisición de tokens en la plataforma.');
    } finally {
      setIsBuying(false);
    }
  };

  const arch = project.architecturalSpecs;
  const constr = project.constructionData;
  const audit = project.budgetAudit;
  const totalBudget = audit?.totalBudgetUSD || totalGoalUSD;
  const executedBudget = audit?.executedBudgetUSD || (totalBudget * (project.progress || 40)) / 100;
  const balanceRemaining = Math.max(0, totalBudget - executedBudget);

  const budgetItems = audit?.budgetItems || [];
  const materialItems = budgetItems.filter((b) => b.category === 'material');
  const payrollItems = budgetItems.filter((b) => b.category === 'payroll');
  const equipmentItems = budgetItems.filter((b) => b.category === 'equipment');

  const annualYield = project.expectedApy || 13.0;
  const projectedAnnualReturnUSD = (tokensToBuy * TOKEN_PRICE_USD * annualYield) / 100;

  return (
    <div className="pdetail-root">
      {/* 1. Barra de navegación superior */}
      <div className="pdetail-nav">
        <Link
          to="/app/projects"
          className="btn btn--ghost btn--sm"
          style={{ paddingLeft: 0, color: 'var(--text-muted)' }}
        >
          <ArrowLeft size={16} />
          <span>Volver al catálogo de proyectos</span>
        </Link>

        <button
          type="button"
          onClick={handleDownloadPDF}
          disabled={isGeneratingPDF}
          className="btn btn--primary btn--sm"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            borderRadius: '10px',
            fontSize: '13px',
          }}
        >
          <FileDown size={14} />
          <span>
            {isGeneratingPDF
              ? 'Generando PDF Oficial...'
              : 'Descargar Presupuesto & Auditoría (.PDF)'}
          </span>
        </button>
      </div>

      {/* 2. Encabezado principal */}
      <div className="pdetail-title-block">
        <h1 className="pdetail-title">{project.name}</h1>
        <p className="pdetail-subtitle">
          <MapPin size={15} style={{ color: 'var(--brand-gold, #d4af37)' }} />
          <span>{project.location}</span>
          <span className="pdetail-sep">•</span>
          <span>{project.category || 'Desarrollo Inmobiliario Integral'}</span>
        </p>
      </div>

      {/* ============================================================== */}
      {/* 3. FILA SUPERIOR: IMÁGENES (IZQUIERDA) Y COMPRA (DERECHA)     */}
      {/* Mismo largo / altura equilibrada horizontalmente                */}
      {/* ============================================================== */}
      <div className="pdetail-top-grid">
        {/* A) Galería de fotos y renders */}
        <div className="pdetail-card pdetail-gallery-card">
          <div className="pdetail-gallery-viewer">
            <img
              src={activeImage.url}
              alt={activeImage.caption || project.name}
              className="pdetail-gallery-img"
            />
            <div className="pdetail-gallery-overlay" />

            <div className="pdetail-gallery-badges">
              <span className="pdetail-category-badge">
                <Camera size={12} style={{ color: 'var(--brand-gold, #d4af37)' }} />
                {activeImage.category === 'render'
                  ? 'Render Arquitectónico'
                  : activeImage.category === 'construction'
                  ? 'Avance de Obra Real'
                  : activeImage.category === 'interior'
                  ? 'Interiores & Unidades'
                  : activeImage.category === 'amenity'
                  ? 'Amenities & Spa'
                  : 'Registro Fotográfico'}
              </span>
              <span className="pdetail-counter-badge">
                {activePhotoIndex + 1} de {images.length}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsLightboxOpen(true)}
              className="pdetail-fullscreen-btn"
              title="Ver en pantalla completa"
              aria-label="Ver en pantalla completa"
            >
              <Maximize2 size={15} />
            </button>

            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={handlePrevPhoto}
                  className="pdetail-gallery-nav-btn prev"
                  aria-label="Foto anterior"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  type="button"
                  onClick={handleNextPhoto}
                  className="pdetail-gallery-nav-btn next"
                  aria-label="Foto siguiente"
                >
                  <ChevronRight size={18} />
                </button>
              </>
            )}

            <div className="pdetail-caption-bar">{activeImage.caption}</div>
          </div>

          {images.length > 1 && (
            <div className="pdetail-thumbnails">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActivePhotoIndex(idx)}
                  className={`pdetail-thumb-btn ${idx === activePhotoIndex ? 'active' : ''}`}
                  aria-label={`Ver foto ${idx + 1}`}
                >
                  <img src={img.url} alt={img.caption || ''} className="pdetail-thumb-img" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* B) Módulo de Adquisición de Tokens */}
        <div className="pdetail-card pdetail-purchase-card">
          {/* 1. Header simplificado */}
          <div className="pdetail-purchase-header">
            <div>
              <h3 className="pdetail-purchase-title">Invertir en el proyecto</h3>
              <p className="pdetail-purchase-subtitle">Elegí la cantidad de tokens</p>
            </div>
            <span className="pdetail-token-code">{tokenSymbol}</span>
          </div>

          {/* 2. Precio con su propio espacio (sin recuadro, sin barra) */}
          <div className="pdetail-price-section">
            <div className="pdetail-price-value">{formatUSD(TOKEN_PRICE_USD)}</div>
            <div className="pdetail-price-label">Precio por token</div>
          </div>

          {/* 3. Selector de cantidad ordenado */}
          <div className="pdetail-calculator-block">
            <div className="pdetail-calc-label-row">
              <label htmlFor="token-qty-input" className="pdetail-calc-label">
                Cantidad de tokens
              </label>
              <span className="pdetail-calc-available">
                {formatNumber(tokensAvailable)} disponibles
              </span>
            </div>

            <div className="pdetail-stepper-box">
              <button
                type="button"
                onClick={() => setTokensToBuy((prev) => Math.max(1, prev - 1))}
                disabled={tokensToBuy <= 1}
                className="pdetail-stepper-btn"
                title="Restar 1 token"
                aria-label="Restar 1 token"
              >
                <Minus size={16} />
              </button>

              <input
                id="token-qty-input"
                type="number"
                min="1"
                max={tokensAvailable > 0 ? tokensAvailable : undefined}
                value={tokensToBuy}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (isNaN(val) || val < 1) {
                    setTokensToBuy(1);
                  } else if (tokensAvailable > 0 && val > tokensAvailable) {
                    setTokensToBuy(tokensAvailable);
                  } else {
                    setTokensToBuy(val);
                  }
                }}
                className="pdetail-stepper-input"
                aria-label="Cantidad de tokens a comprar"
              />

              <button
                type="button"
                onClick={() =>
                  setTokensToBuy((prev) =>
                    tokensAvailable > 0 ? Math.min(tokensAvailable, prev + 1) : prev + 1
                  )
                }
                disabled={tokensAvailable > 0 && tokensToBuy >= tokensAvailable}
                className="pdetail-stepper-btn"
                title="Sumar 1 token"
                aria-label="Sumar 1 token"
              >
                <Plus size={16} />
              </button>
            </div>

            {/* Accesos rápidos con opción seleccionada marcada */}
            <div className="pdetail-chips-row">
              {[5, 10, 25, 50].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() =>
                    setTokensToBuy(
                      tokensAvailable > 0 ? Math.min(tokensAvailable, preset) : preset
                    )
                  }
                  className={`pdetail-preset-chip ${tokensToBuy === preset ? 'active' : ''}`}
                  disabled={tokensAvailable > 0 && tokensAvailable < preset && tokensToBuy !== preset}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* 4. Un solo bloque para el resumen */}
          <div className="pdetail-summary-block">
            <div className="pdetail-summary-label">Total a invertir</div>
            <div className="pdetail-summary-total">
              {formatUSD(tokensToBuy * TOKEN_PRICE_USD)}
            </div>
            <div className="pdetail-summary-estimate">
              Rendimiento anual estimado (+{annualYield}%): +{formatUSD(projectedAnnualReturnUSD)} / año
            </div>
          </div>

          {/* Error si ocurre */}
          {buyError && (
            <div className="pdetail-alert-box error">
              <AlertCircle size={15} style={{ flexShrink: 0, marginTop: '1px' }} />
              <span>{buyError}</span>
            </div>
          )}

          {/* Éxito de compra */}
          {purchaseSuccess && (
            <div className="pdetail-alert-box success">
              <Sparkles size={16} style={{ color: '#10b981', flexShrink: 0, marginTop: '1px' }} />
              <div>
                <strong style={{ color: '#10b981', display: 'block', marginBottom: '2px' }}>
                  ¡Inversión confirmada!
                </strong>
                <span>
                  Adquiriste {formatNumber(purchaseSuccess.tokens)} tokens ({formatUSD(purchaseSuccess.amount)}).
                </span>
              </div>
            </div>
          )}

          {/* 5. Botón de Confirmación Principal acortado */}
          <button
            type="button"
            onClick={handleBuyTokens}
            disabled={isBuying || tokensAvailable <= 0}
            className="pdetail-cta-btn"
          >
            <span>
              {isBuying
                ? 'Confirmando inversión...'
                : tokensAvailable <= 0
                ? 'Desarrollo fondeado'
                : 'Confirmar inversión'}
            </span>
          </button>

          {/* 6. Pie discreto con enlace a la documentación */}
          <div className="pdetail-legal-footer">
            <button
              type="button"
              onClick={handleDownloadPDF}
              className="pdetail-legal-link"
              title="Consultar documentación del fideicomiso"
            >
              <FileText size={14} />
              <span>Consultar documentación del fideicomiso</span>
            </button>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 4. SECCIÓN INFERIOR FULL WIDTH (ANCHO COMPLETO)                */}
      {/* Ocupa el ancho combinado de las dos cards superiores            */}
      {/* ============================================================== */}
      <div className="pdetail-full-stack">
        {/* CARD 1: INFORMACIÓN DEL DESARROLLO (FULL WIDTH) */}
        <div className="pdetail-card pdetail-card--padded">
          <h2 className="pdetail-section-title">Información del Desarrollo</h2>
          <p className="pdetail-desc">{project.description}</p>

          {arch?.designConcept && (
            <p className="pdetail-concept">{arch.designConcept}</p>
          )}

          {/* Ficha técnica ejecutiva (4 columnas full width) */}
          <div className="pdetail-metrics-grid">
            <div className="pdetail-metric-box">
              <span className="pdetail-metric-label">Rendimiento Estimado</span>
              <strong className="pdetail-metric-val emerald">
                {formatPercent(annualYield)} APY
              </strong>
              <span className="pdetail-metric-sub">Rentas y plusvalía en USD</span>
            </div>

            <div className="pdetail-metric-box">
              <span className="pdetail-metric-label">Inversión Mínima</span>
              <strong className="pdetail-metric-val">
                {formatUSD(project.minInvestment || 500)}
              </strong>
              <span className="pdetail-metric-sub">Desde 1 token / cuotaparte</span>
            </div>

            <div className="pdetail-metric-box">
              <span className="pdetail-metric-label">Plazo de Obra</span>
              <strong className="pdetail-metric-val">
                {project.durationMonths || 18} meses
              </strong>
              <span className="pdetail-metric-sub">
                Entrega: {constr?.estimatedDeliveryDate || 'Mayo 2027'}
              </span>
            </div>

            <div className="pdetail-metric-box">
              <span className="pdetail-metric-label">Superficie Total</span>
              <strong className="pdetail-metric-val">
                {formatNumber(arch?.totalBuiltAreaM2 || 18400)} m²
              </strong>
              <span className="pdetail-metric-sub">
                Vendibles: {formatNumber(arch?.sellableAreaM2 || 13900)} m²
              </span>
            </div>
          </div>

          {/* Desarrollador y Custodia Fiduciaria */}
          <div className="pdetail-stakeholders-grid">
            <div className="pdetail-stakeholder-box">
              <div className="pdetail-stakeholder-header">
                <Building2 size={15} style={{ color: 'var(--brand-gold, #d4af37)' }} />
                <span className="pdetail-stakeholder-role">Desarrollador Responsable</span>
                {developer?.verificationStatus === 'verified' && (
                  <span title="Desarrollador Verificado Jurídicamente" style={{ display: 'inline-flex' }}>
                    <ShieldCheck size={15} style={{ color: '#10b981' }} />
                  </span>
                )}
              </div>
              <strong className="pdetail-stakeholder-name">
                {project.developerName || developer?.companyName}
              </strong>
              <div className="pdetail-stakeholder-meta">
                <span>CUIT: {developer?.cuit || '30-71891234-5'}</span>
                <span>•</span>
                <span>+{formatNumber(developer?.deliveredM2 || 45000)} m² entregados</span>
              </div>
            </div>

            <div className="pdetail-stakeholder-box">
              <div className="pdetail-stakeholder-header">
                <ShieldCheck size={15} style={{ color: '#10b981' }} />
                <span className="pdetail-stakeholder-role">Custodia Fiduciaria</span>
              </div>
              <strong className="pdetail-stakeholder-name">
                {constr?.fiduciaryTrustee || 'Banco de Valores S.A.'}
              </strong>
              <div className="pdetail-stakeholder-meta">
                <span>Ley 24.441 de Fideicomisos</span>
                <span>•</span>
                <span>Patrimonio Blindado</span>
              </div>
            </div>
          </div>

          {/* Amenities y equipamiento */}
          {arch?.amenitiesDescription && (
            <div className="pdetail-amenities-box">
              <span className="pdetail-amenities-title">Amenities & Equipamiento Premium</span>
              <p className="pdetail-amenities-text">{arch.amenitiesDescription}</p>
            </div>
          )}
        </div>

        {/* CARD 2: DETALLE DE SEGUIMIENTO DE LA OBRA (FULL WIDTH) */}
        <div className="pdetail-card pdetail-card--padded">
          <div className="pdetail-tracking-header">
            <div>
              <span className="pdetail-badge-super">Control Pericial & Bitácora</span>
              <h2 className="pdetail-section-title" style={{ margin: 0 }}>
                Seguimiento de la Obra
              </h2>
            </div>

            <div className="pdetail-progress-summary-pill">
              <div className="pdetail-progress-val">{project.progress}%</div>
              <div className="pdetail-progress-lbl">
                <strong>Avance Físico Certificado</strong>
                <div style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <CheckCircle2 size={11} /> Conforme a cronograma
                </div>
              </div>
            </div>
          </div>

          {/* Banner de estado de obra actual */}
          {constr?.currentWorkStatusSummary && (
            <div className="pdetail-workstatus-banner">
              <Clock
                size={16}
                style={{ color: 'var(--brand-gold, #d4af37)', flexShrink: 0, marginTop: '2px' }}
              />
              <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.5, color: 'var(--text-secondary)' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Inspección al día de hoy: </strong>
                {constr.currentWorkStatusSummary}
              </p>
            </div>
          )}

          {/* Barra de progreso de avance de obra */}
          <div style={{ marginBottom: '20px' }}>
            <div className="pdetail-track" style={{ height: '7px' }}>
              <div className="pdetail-fill" style={{ width: `${project.progress}%` }} />
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: '6px',
                fontSize: '11.5px',
                color: 'var(--text-muted)',
              }}
            >
              <span>Cimentaciones & Estructura (100%)</span>
              <span>Terminaciones & Entrega ({project.progress}%)</span>
            </div>
          </div>

          {/* Pestañas de seguimiento detallado */}
          <div className="pdetail-tabs-bar">
            <button
              type="button"
              className={`pdetail-tab-btn ${activeTab === 'tracking' ? 'active' : ''}`}
              onClick={() => setActiveTab('tracking')}
            >
              <Clock size={14} />
              <span>Hitos Constructivos ({project.progressMilestones?.length || 5})</span>
            </button>

            <button
              type="button"
              className={`pdetail-tab-btn ${activeTab === 'budget' ? 'active' : ''}`}
              onClick={() => setActiveTab('budget')}
            >
              <DollarSign size={14} />
              <span>Presupuesto & Gastos Auditados</span>
            </button>

            <button
              type="button"
              className={`pdetail-tab-btn ${activeTab === 'architecture' ? 'active' : ''}`}
              onClick={() => setActiveTab('architecture')}
            >
              <Ruler size={14} />
              <span>Memoria Técnica & Arquitectura</span>
            </button>

            <button
              type="button"
              className={`pdetail-tab-btn ${activeTab === 'legal' ? 'active' : ''}`}
              onClick={() => setActiveTab('legal')}
            >
              <ShieldCheck size={14} />
              <span>Marco Legal & Fiduciario</span>
            </button>
          </div>

          {/* PESTAÑA 1: HITOS CONSTRUCTIVOS */}
          {activeTab === 'tracking' && (
            <div style={{ display: 'grid', gap: '16px', position: 'relative', paddingLeft: '26px' }}>
              <div
                style={{
                  position: 'absolute',
                  left: '9px',
                  top: '8px',
                  bottom: '8px',
                  width: '2px',
                  background: 'var(--surface-glass-border)',
                }}
              />

              {(project.progressMilestones || []).map((m) => {
                const isDone = m.status === 'completed';
                const isCurrent = m.status === 'in_progress';

                return (
                  <div key={m.id} style={{ position: 'relative' }}>
                    <div
                      style={{
                        position: 'absolute',
                        left: '-26px',
                        top: '2px',
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        background: 'var(--surface-card)',
                        border: isDone
                          ? '2px solid #10b981'
                          : isCurrent
                          ? '2px solid var(--text-primary)'
                          : '2px solid var(--text-muted)',
                        display: 'grid',
                        placeItems: 'center',
                        color: isDone ? '#10b981' : 'var(--text-primary)',
                      }}
                    >
                      {isDone ? (
                        <CheckCircle2 size={11} />
                      ) : isCurrent ? (
                        <div
                          style={{
                            width: '5px',
                            height: '5px',
                            borderRadius: '50%',
                            background: '#10b981',
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: '4px',
                            height: '4px',
                            borderRadius: '50%',
                            background: 'var(--text-muted)',
                          }}
                        />
                      )}
                    </div>

                    <div
                      style={{
                        background: 'var(--color-surface-raised)',
                        padding: '14px 18px',
                        borderRadius: '12px',
                        border: '1px solid var(--surface-glass-border)',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'baseline',
                          marginBottom: '3px',
                          flexWrap: 'wrap',
                          gap: '6px',
                        }}
                      >
                        <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
                          {m.title}
                        </strong>
                        <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                          {m.date}
                        </span>
                      </div>

                      <p
                        style={{
                          fontSize: '13px',
                          color: 'var(--text-secondary)',
                          margin: '3px 0 6px',
                          lineHeight: 1.45,
                        }}
                      >
                        {m.reportSummary}
                      </p>

                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: '11px',
                          color: 'var(--text-muted)',
                          borderTop: '1px solid var(--surface-glass-border)',
                          paddingTop: '6px',
                        }}
                      >
                        <span>Auditor: {m.inspector}</span>
                        <span
                          style={{
                            fontWeight: 600,
                            color: isDone ? '#10b981' : isCurrent ? 'var(--brand-gold, #d4af37)' : 'var(--text-muted)',
                          }}
                        >
                          {isDone ? 'Certificado 100%' : isCurrent ? `En curso (${m.percentage}%)` : 'Programado'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* PESTAÑA 2: PRESUPUESTO & GASTOS AUDITADOS */}
          {activeTab === 'budget' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                  gap: '10px',
                }}
              >
                <div
                  style={{
                    background: 'var(--color-surface-raised)',
                    padding: '14px',
                    borderRadius: '10px',
                    border: '1px solid var(--surface-glass-border)',
                  }}
                >
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Presupuesto Total</span>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                    {formatUSD(totalBudget)}
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Fideicomiso auditado</span>
                </div>

                <div
                  style={{
                    background: 'var(--color-surface-raised)',
                    padding: '14px',
                    borderRadius: '10px',
                    border: '1px solid var(--surface-glass-border)',
                  }}
                >
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Ejecutado a la Fecha</span>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#10b981', marginTop: '2px' }}>
                    {formatUSD(executedBudget)}
                  </div>
                  <span style={{ fontSize: '11px', color: '#10b981' }}>
                    {formatPercent((executedBudget / totalBudget) * 100)} del total
                  </span>
                </div>

                <div
                  style={{
                    background: 'var(--color-surface-raised)',
                    padding: '14px',
                    borderRadius: '10px',
                    border: '1px solid var(--surface-glass-border)',
                  }}
                >
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Saldo en Custodia</span>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                    {formatUSD(balanceRemaining)}
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Cuenta bancaria remunerada</span>
                </div>
              </div>

              {/* Sub-pestañas de rubros */}
              <div style={{ display: 'flex', gap: '6px', borderBottom: '1px solid var(--surface-glass-border)', paddingBottom: '6px' }}>
                <button
                  type="button"
                  onClick={() => setBudgetSubTab('materials')}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    background: budgetSubTab === 'materials' ? 'var(--color-surface-raised)' : 'transparent',
                    color: budgetSubTab === 'materials' ? 'var(--text-primary)' : 'var(--text-muted)',
                    fontWeight: 600,
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  Materiales ({materialItems.length})
                </button>
                <button
                  type="button"
                  onClick={() => setBudgetSubTab('payroll')}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    background: budgetSubTab === 'payroll' ? 'var(--color-surface-raised)' : 'transparent',
                    color: budgetSubTab === 'payroll' ? 'var(--text-primary)' : 'var(--text-muted)',
                    fontWeight: 600,
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  Mano de Obra & UOCRA ({payrollItems.length})
                </button>
                <button
                  type="button"
                  onClick={() => setBudgetSubTab('equipment')}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    background: budgetSubTab === 'equipment' ? 'var(--color-surface-raised)' : 'transparent',
                    color: budgetSubTab === 'equipment' ? 'var(--text-primary)' : 'var(--text-muted)',
                    fontWeight: 600,
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  Maquinaria & Equipos ({equipmentItems.length})
                </button>
              </div>

              {/* Tabla de partidas */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--surface-glass-border)', color: 'var(--text-muted)', textAlign: 'left' }}>
                      <th style={{ padding: '8px 10px' }}>Concepto</th>
                      <th style={{ padding: '8px 10px' }}>Proveedor / Entidad</th>
                      <th style={{ padding: '8px 10px' }}>Comprobante</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Total USD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(budgetSubTab === 'materials'
                      ? materialItems
                      : budgetSubTab === 'payroll'
                      ? payrollItems
                      : equipmentItems
                    ).map((item) => (
                      <tr
                        key={item.id}
                        style={{
                          borderBottom: '1px solid var(--surface-glass-border)',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        <td style={{ padding: '10px' }}>
                          <strong style={{ color: 'var(--text-primary)', display: 'block' }}>{item.concept}</strong>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{item.details}</span>
                        </td>
                        <td style={{ padding: '10px' }}>{item.recipientOrSupplier}</td>
                        <td style={{ padding: '10px', fontFamily: 'inherit', fontSize: '11.5px' }}>
                          {item.receiptNumber}
                        </td>
                        <td style={{ padding: '10px', textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {formatUSD(item.totalUSD)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* PESTAÑA 3: MEMORIA TÉCNICA */}
          {activeTab === 'architecture' && (
            <div style={{ display: 'grid', gap: '12px' }}>
              <div
                style={{
                  background: 'var(--color-surface-raised)',
                  padding: '16px 18px',
                  borderRadius: '12px',
                  border: '1px solid var(--surface-glass-border)',
                }}
              >
                <strong style={{ fontSize: '14px', color: 'var(--text-primary)', display: 'block', marginBottom: '6px' }}>
                  Estudio de Arquitectura & Proyectistas
                </strong>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {arch?.studioName || 'Dujovne-Hirsch & Associates'} · {arch?.leadArchitect || 'Arq. Silvina Hirsch'}
                </p>
                <p style={{ margin: '6px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                  Cálculo estructural: {arch?.structuralEngineer || 'Ing. Alberto Fainstein & Asoc.'}
                </p>
              </div>

              <div
                style={{
                  background: 'var(--color-surface-raised)',
                  padding: '16px 18px',
                  borderRadius: '12px',
                  border: '1px solid var(--surface-glass-border)',
                }}
              >
                <strong style={{ fontSize: '14px', color: 'var(--text-primary)', display: 'block', marginBottom: '6px' }}>
                  Sustentabilidad & Normativas
                </strong>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {arch?.sustainabilityRating || 'Certificación EDGE Green Buildings'}
                </p>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                  Permiso de Obra: {constr?.permitNumber || 'PERM-OBRA-NU-7419/2025'}
                </p>
              </div>
            </div>
          )}

          {/* PESTAÑA 4: MARCO LEGAL */}
          {activeTab === 'legal' && (
            <div style={{ display: 'grid', gap: '12px' }}>
              <div
                style={{
                  background: 'var(--color-surface-raised)',
                  padding: '16px 18px',
                  borderRadius: '12px',
                  border: '1px solid var(--surface-glass-border)',
                }}
              >
                <strong style={{ fontSize: '14px', color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                  Estructuración Fiduciaria (Ley 24.441)
                </strong>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  El patrimonio del desarrollo se encuentra 100% blindado bajo fideicomiso inmobiliario independiente. Los activos de la obra no responden por deudas del desarrollador.
                </p>
              </div>

              <div
                style={{
                  background: 'var(--color-surface-raised)',
                  padding: '16px 18px',
                  borderRadius: '12px',
                  border: '1px solid var(--surface-glass-border)',
                }}
              >
                <strong style={{ fontSize: '14px', color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                  Póliza Todo Riesgo Construcción
                </strong>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {constr?.insurancePolicy || 'Sancor Seguros - Póliza Todo Riesgo Construcción'}
                </p>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                  Escribanía interviniente: {constr?.notaryPublic || 'Escribanía Bunge & Asoc.'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Lightbox Modal para fotos en pantalla completa */}
      {isLightboxOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Visor fotográfico ampliado"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(9, 9, 11, 0.94)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '24px',
          }}
          onClick={() => setIsLightboxOpen(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setIsLightboxOpen(false);
            if (e.key === 'ArrowRight') handleNextPhoto();
            if (e.key === 'ArrowLeft') handlePrevPhoto();
          }}
          tabIndex={0}
        >
          <button
            type="button"
            onClick={() => setIsLightboxOpen(false)}
            aria-label="Cerrar visor"
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#ffffff',
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
              zIndex: 10,
            }}
          >
            <X size={18} />
          </button>

          <div
            style={{
              maxWidth: '1000px',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              position: 'relative',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={activeImage.url}
              alt={activeImage.caption || project.name}
              style={{
                maxWidth: '100%',
                maxHeight: '72vh',
                objectFit: 'contain',
                borderRadius: '14px',
                boxShadow: '0 25px 60px rgba(0,0,0,0.85)',
              }}
            />
            <p style={{ marginTop: '14px', color: '#e4e4e7', fontSize: '14px', textAlign: 'center' }}>
              {activeImage.caption}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
