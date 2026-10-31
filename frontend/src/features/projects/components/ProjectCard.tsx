import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, ShieldCheck, ArrowRight, Camera } from 'lucide-react';
import { Project } from '../../../types';
import { formatNumber, formatUSD, formatPercent } from '../../../utils/formatters';
import './ProjectCard.css';

export interface ProjectCardProps {
  project: Project;
  isDeveloperVerified?: boolean;
  isFideicomisoInscripto?: boolean;
  onOpenGallery?: (project: Project) => void;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  isDeveloperVerified = false,
  onOpenGallery,
}) => {
  // Safe financial data computation
  const hasValidGoal = typeof project.fundingGoal === 'number' && project.fundingGoal > 0;
  const hasValidRaised = typeof project.fundsRaised === 'number' && !isNaN(project.fundsRaised);
  const hasValidFunding = hasValidGoal && hasValidRaised;

  const goalUSD = hasValidGoal ? project.fundingGoal / 100 : 0;
  const raisedUSD = hasValidRaised ? project.fundsRaised / 100 : 0;

  let fundedPercent: number | null = null;
  if (hasValidFunding) {
    if (typeof project.fundedPercent === 'number' && !isNaN(project.fundedPercent)) {
      fundedPercent = project.fundedPercent;
    } else if (goalUSD > 0) {
      fundedPercent = Math.round((raisedUSD / goalUSD) * 100);
    }
  }

  // Token metrics
  const tokenPriceUSD = 100;
  const totalTokens = goalUSD > 0 ? Math.floor(goalUSD / tokenPriceUSD) : 0;
  const soldTokens = raisedUSD > 0 ? Math.floor(raisedUSD / tokenPriceUSD) : 0;
  const tokensAvailable = Math.max(0, totalTokens - soldTokens);

  // Photographic & Render Assets
  const cardImage =
    project.imageUrl ||
    project.images?.[0]?.url ||
    'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80';

  const isRender =
    project.images?.some((img) => img.url === cardImage && img.category === 'render') ||
    project.images?.[0]?.category === 'render';

  const imageAlt = isRender
    ? `Render arquitectónico de ${project.name}`
    : `Fotografía de ${project.name}`;

  const photosCount = project.images ? project.images.length : project.imageUrl ? 1 : 0;

  // Expected APY / Annual return
  const expectedYield =
    typeof project.expectedApy === 'number' && !isNaN(project.expectedApy)
      ? project.expectedApy
      : null;

  // Developer simplified commercial name
  const developerName =
    project.developerName
      ? project.developerName.replace(/\s+(S\.A\.|S\.A\.S\.|S\.R\.L\.|S\.A|SAS|SRL)$/i, '').trim()
      : '';

  return (
    <article className="project-card" aria-labelledby={`project-title-${project.id}`}>
      {/* 1. Imagen protagonista (420px escritorio, solo acceso a fotos discreto) */}
      <div className="project-card__image-container">
        <img
          src={cardImage}
          alt={imageAlt}
          className="project-card__image"
          loading="lazy"
        />
        <div className="project-card__image-overlay" />

        {/* Solo acceso a fotos sobre la imagen, arriba a la izquierda */}
        {photosCount > 0 && (
          <div className="project-card__badges">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenGallery?.(project);
              }}
              className="project-card__badge-photos"
              aria-label={`Ver galería de fotos de ${project.name} (${photosCount} disponibles)`}
            >
              <Camera size={13} aria-hidden="true" style={{ color: 'var(--brand-gold, #d4af37)' }} />
              <span>{photosCount} fotos</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. Cuerpo de la tarjeta con flujo vertical continuo */}
      <div className="project-card__body">
        {/* Encabezado: Nombre y ubicación */}
        <div className="project-card__header-group">
          <h2 id={`project-title-${project.id}`} className="project-card__title">
            <Link to={`/app/projects/${project.id}`} className="project-card__title-link">
              {project.name}
            </Link>
          </h2>

          <div className="project-card__location">
            <MapPin size={15} aria-hidden="true" className="project-card__location-icon" />
            <span>{project.location}</span>
          </div>

          {/* Rendimiento anual estimado: fuera de la imagen, debajo de la ubicación */}
          {expectedYield !== null && (
            <div className="project-card__yield">
              <span className="project-card__yield-val">{formatPercent(expectedYield)}</span>
              <span className="project-card__yield-label">anual estimado</span>
            </div>
          )}
        </div>

        {/* Empresa y descripción breve */}
        <div className="project-card__meta-group">
          {developerName && (
            <div className="project-card__developer">
              <span className="project-card__developer-name">{developerName}</span>
              {isDeveloperVerified && (
                <ShieldCheck
                  size={14}
                  className="project-card__developer-verified"
                  aria-label="Desarrollador verificado"
                />
              )}
            </div>
          )}

          <p className="project-card__description">
            {project.description}
          </p>
        </div>

        {/* Bloque de financiamiento: Financiado + barra + importes */}
        <div className="project-card__funding">
          {hasValidFunding && fundedPercent !== null ? (
            <>
              <div className="project-card__funding-header">
                <span className="project-card__funding-label">Financiado</span>
                <span className="project-card__funding-percentage">
                  {formatPercent(fundedPercent)}
                </span>
              </div>

              <div
                className="project-card__progress-track"
                role="progressbar"
                aria-valuenow={fundedPercent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Progreso de financiamiento: ${formatPercent(fundedPercent)}`}
              >
                <div
                  className="project-card__progress-fill"
                  style={{ width: `${Math.min(Math.max(0, fundedPercent), 100)}%` }}
                />
              </div>

              <div className="project-card__funding-amounts">
                {formatUSD(raisedUSD)} de {formatUSD(goalUSD)}
              </div>
            </>
          ) : (
            <div className="project-card__funding-unavailable">
              Financiamiento no disponible
            </div>
          )}
        </div>

        {/* Bloque de tokens: Precio por token y Disponibles */}
        <div className="project-card__metrics">
          <div className="project-card__metric-col">
            <span className="project-card__metric-label">Precio por token</span>
            <strong className="project-card__metric-value">
              {formatUSD(tokenPriceUSD)}
            </strong>
          </div>
          <div className="project-card__metric-col">
            <span className="project-card__metric-label">Disponibles</span>
            <strong className="project-card__metric-value">
              {formatNumber(tokensAvailable)}
            </strong>
          </div>
        </div>

        {/* Botón principal: 16px sobre el bloque de tokens, 48px de alto, todo el ancho */}
        <Link
          to={`/app/projects/${project.id}`}
          className="project-card__cta-btn"
        >
          <span>Ver proyecto</span>
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
};
