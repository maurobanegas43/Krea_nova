import React, { useEffect, useState, useMemo } from 'react';
import {
  Search,
  X,
  Building2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { api } from '../../services/api';
import { Project, DeveloperProfile } from '../../types';
import { getProjectAuditDetails } from '../../services/projectAuditData';
import { ProjectCard } from './components/ProjectCard';

export const ProjectsPage: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [developers, setDevelopers] = useState<DeveloperProfile[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [galleryProject, setGalleryProject] = useState<Project | null>(null);
  const [activePhotoIdx, setActivePhotoIdx] = useState<number>(0);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    Promise.all([api.getProjects(), api.getDevelopers()]).then(([projs, devs]) => {
      setProjects(projs);
      setDevelopers(devs);
    });
  }, []);

  const developerMap = useMemo(() => {
    const map = new Map<string, DeveloperProfile>();
    developers.forEach((d) => map.set(d.id, d));
    return map;
  }, [developers]);

  const filteredProjects = projects.filter((p) => {
    const matchesFilter =
      filter === 'all' ||
      (filter === 'residential' && (p.category?.includes('Residencial') || p.name.includes('Residencias') || p.name.includes('Coliving') || p.category?.includes('Turismo'))) ||
      (filter === 'corporate' && (p.category?.includes('Corporativo') || p.category?.includes('Logística') || p.name.includes('Torre') || p.name.includes('Parque') || p.category?.includes('Usos Mixtos')));

    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.developerName ? p.developerName.toLowerCase().includes(searchTerm.toLowerCase()) : false);

    return matchesFilter && matchesSearch;
  });

  return (
    <div
      style={{
        maxWidth: '1200px',
        margin: '0 auto',
        paddingLeft: 'clamp(16px, 4vw, 32px)',
        paddingRight: 'clamp(16px, 4vw, 32px)',
        paddingTop: 'clamp(24px, 4vh, 48px)',
        paddingBottom: '80px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Centered Header Section */}
      <div style={{ textAlign: 'center', maxWidth: '840px', margin: '0 auto 40px', width: '100%' }}>
        <h1
          style={{
            fontSize: 'clamp(2.25rem, 5vw, 3.5rem)',
            lineHeight: 1.1,
            letterSpacing: '-0.035em',
            marginBottom: '16px',
            color: 'var(--text-primary)',
            fontWeight: 800,
          }}
        >
          Oportunidades de Inversión
        </h1>

        <p
          style={{
            fontSize: 'clamp(1rem, 1.8vw, 1.125rem)',
            lineHeight: 1.65,
            color: 'var(--text-muted)',
            maxWidth: '680px',
            margin: '0 auto 36px',
          }}
        >
          Desarrollos premium auditados legal y técnicamente. Invertí desde{' '}
          <strong style={{ color: 'var(--text-primary)' }}>$500 USD</strong> con respaldo en fideicomiso y cobrá dividendos en dólares.
        </p>

        {/* Harmonic Search & Filter Control Bar */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px', width: '100%' }}>
          {/* Centered, Generously Proportioned Search Bar */}
          <div
            style={{
              width: '100%',
              maxWidth: '560px',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Search
              size={19}
              style={{
                position: 'absolute',
                left: '20px',
                color: 'var(--text-muted)',
                pointerEvents: 'none',
              }}
            />

            <input
              type="text"
              placeholder="Buscar por zona, ciudad o proyecto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                height: '52px',
                paddingLeft: '52px',
                paddingRight: searchTerm ? '46px' : '20px',
                fontSize: '15px',
                fontFamily: 'var(--font-body)',
                color: 'var(--text-primary)',
                background: 'var(--surface-card)',
                border: '1px solid var(--surface-glass-border)',
                borderRadius: '999px',
                boxShadow: 'var(--shadow-card)',
                outline: 'none',
                transition: 'border-color var(--transition-fast), box-shadow var(--transition-fast)',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--text-primary)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--surface-glass-border)';
              }}
            />

            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                style={{
                  position: 'absolute',
                  right: '16px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  display: 'grid',
                  placeItems: 'center',
                  padding: '4px',
                }}
                title="Limpiar búsqueda"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Centered Category Pills */}
          <div
            style={{
              display: 'flex',
              gap: '10px',
              flexWrap: 'wrap',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <button
              onClick={() => setFilter('all')}
              style={{
                fontFamily: 'var(--font-body, "Inter", sans-serif)',
                height: '40px',
                padding: '0 20px',
                fontSize: '14px',
                fontWeight: 600,
                borderRadius: '999px',
                cursor: 'pointer',
                border: '1px solid',
                borderColor: filter === 'all' ? 'transparent' : 'var(--surface-glass-border)',
                background: filter === 'all' ? 'var(--btn-primary-bg)' : 'var(--surface-card)',
                color: filter === 'all' ? 'var(--btn-primary-text)' : 'var(--text-muted)',
                transition: 'all var(--transition-fast)',
              }}
            >
              Todos ({projects.length})
            </button>

            <button
              onClick={() => setFilter('residential')}
              style={{
                fontFamily: 'var(--font-body, "Inter", sans-serif)',
                height: '40px',
                padding: '0 20px',
                fontSize: '14px',
                fontWeight: 600,
                borderRadius: '999px',
                cursor: 'pointer',
                border: '1px solid',
                borderColor: filter === 'residential' ? 'transparent' : 'var(--surface-glass-border)',
                background: filter === 'residential' ? 'var(--btn-primary-bg)' : 'var(--surface-card)',
                color: filter === 'residential' ? 'var(--btn-primary-text)' : 'var(--text-muted)',
                transition: 'all var(--transition-fast)',
              }}
            >
              Residencial
            </button>

            <button
              onClick={() => setFilter('corporate')}
              style={{
                fontFamily: 'var(--font-body, "Inter", sans-serif)',
                height: '40px',
                padding: '0 20px',
                fontSize: '14px',
                fontWeight: 600,
                borderRadius: '999px',
                cursor: 'pointer',
                border: '1px solid',
                borderColor: filter === 'corporate' ? 'transparent' : 'var(--surface-glass-border)',
                background: filter === 'corporate' ? 'var(--btn-primary-bg)' : 'var(--surface-card)',
                color: filter === 'corporate' ? 'var(--btn-primary-text)' : 'var(--text-muted)',
                transition: 'all var(--transition-fast)',
              }}
            >
              Corporativo y logística
            </button>
          </div>
        </div>
      </div>

      {/* Catalog Cards Grid - auto-fill preserves identical column width regardless of filter count */}
      {filteredProjects.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '64px 24px',
            color: 'var(--text-muted)',
            background: 'var(--surface-card)',
            borderRadius: '20px',
            border: '1px solid var(--surface-glass-border)',
            width: '100%',
          }}
        >
          <Building2 size={44} style={{ margin: '0 auto 16px', opacity: 0.35 }} />
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
            No se encontraron oportunidades
          </h3>
          <p style={{ fontSize: '14px', maxWidth: '420px', margin: '0 auto 20px', lineHeight: 1.6 }}>
            No encontramos desarrollos que coincidan con la búsqueda o el filtro seleccionado.
          </p>
          <button
            onClick={() => {
              setFilter('all');
              setSearchTerm('');
            }}
            style={{
              height: '40px',
              padding: '0 22px',
              fontSize: '14px',
              fontWeight: 600,
              borderRadius: '999px',
              cursor: 'pointer',
              border: '1px solid var(--surface-glass-border)',
              background: 'var(--surface-card)',
              color: 'var(--text-primary)',
              transition: 'all var(--transition-fast)',
            }}
          >
            Restablecer filtros
          </button>
        </div>
      ) : (
        <div className="projects-grid">
          {filteredProjects.map((p) => {
            const dev = developerMap.get(p.developerId);
            const isDeveloperVerified = dev?.verificationStatus === 'verified';
            const audit = getProjectAuditDetails(p.id);
            const isFideicomisoInscripto = Boolean(audit?.constructionData?.fiduciaryTrustee);

            return (
              <ProjectCard
                key={p.id}
                project={p}
                isDeveloperVerified={isDeveloperVerified}
                isFideicomisoInscripto={isFideicomisoInscripto}
                onOpenGallery={(proj) => {
                  setGalleryProject(proj);
                  setActivePhotoIdx(0);
                }}
              />
            );
          })}
        </div>
      )}

      {/* Lightbox / Galería accesible para inspección fotográfica */}
      {galleryProject && galleryProject.images && galleryProject.images.length > 0 && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Galería fotográfica de ${galleryProject.name}`}
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
          onClick={() => setGalleryProject(null)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setGalleryProject(null);
            if (e.key === 'ArrowRight') {
              setActivePhotoIdx((prev) => (prev + 1) % galleryProject.images!.length);
            }
            if (e.key === 'ArrowLeft') {
              setActivePhotoIdx(
                (prev) => (prev - 1 + galleryProject.images!.length) % galleryProject.images!.length
              );
            }
          }}
          tabIndex={0}
        >
          {/* Botón de cierre accesible */}
          <button
            type="button"
            onClick={() => setGalleryProject(null)}
            aria-label="Cerrar visor de galería"
            style={{
              position: 'absolute',
              top: '24px',
              right: '24px',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#ffffff',
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
              zIndex: 10,
              transition: 'background var(--transition-fast, 150ms ease)',
            }}
          >
            <X size={20} />
          </button>

          {/* Contenido de la fotografía activa */}
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
            <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>
              <img
                src={galleryProject.images[activePhotoIdx].url}
                alt={galleryProject.images[activePhotoIdx].caption || galleryProject.name}
                style={{
                  maxWidth: '100%',
                  maxHeight: '70vh',
                  objectFit: 'contain',
                  borderRadius: '16px',
                  boxShadow: '0 25px 60px rgba(0,0,0,0.85)',
                }}
              />

              {/* Botones de navegación Prev / Next con teclado y cursor */}
              {galleryProject.images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setActivePhotoIdx(
                        (prev) => (prev - 1 + galleryProject.images!.length) % galleryProject.images!.length
                      )
                    }
                    aria-label="Fotografía anterior"
                    style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'rgba(9, 9, 11, 0.8)',
                      border: '1px solid rgba(255, 255, 255, 0.25)',
                      color: '#ffffff',
                      width: '44px',
                      height: '44px',
                      borderRadius: '50%',
                      display: 'grid',
                      placeItems: 'center',
                      cursor: 'pointer',
                      backdropFilter: 'blur(8px)',
                    }}
                  >
                    <ChevronLeft size={22} />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setActivePhotoIdx((prev) => (prev + 1) % galleryProject.images!.length)
                    }
                    aria-label="Fotografía siguiente"
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'rgba(9, 9, 11, 0.8)',
                      border: '1px solid rgba(255, 255, 255, 0.25)',
                      color: '#ffffff',
                      width: '44px',
                      height: '44px',
                      borderRadius: '50%',
                      display: 'grid',
                      placeItems: 'center',
                      cursor: 'pointer',
                      backdropFilter: 'blur(8px)',
                    }}
                  >
                    <ChevronRight size={22} />
                  </button>
                </>
              )}
            </div>

            <div
              style={{
                marginTop: '16px',
                textAlign: 'center',
                color: '#ffffff',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span
                  style={{
                    background: 'rgba(255, 255, 255, 0.12)',
                    padding: '4px 12px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--brand-gold, #d4af37)',
                  }}
                >
                  {galleryProject.images[activePhotoIdx].category === 'render'
                    ? 'Render Arquitectónico'
                    : galleryProject.images[activePhotoIdx].category === 'construction'
                    ? 'Avance de Obra Real'
                    : galleryProject.images[activePhotoIdx].category === 'interior'
                    ? 'Interiores & Semipisos'
                    : galleryProject.images[activePhotoIdx].category === 'amenity'
                    ? 'Amenities & Spa'
                    : 'Registro Fotográfico'}
                </span>
                <span style={{ fontSize: '13px', color: 'var(--text-muted, #a1a1aa)' }}>
                  {activePhotoIdx + 1} de {galleryProject.images.length}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '14px', color: '#e4e4e7', maxWidth: '640px', lineHeight: 1.45 }}>
                {galleryProject.images[activePhotoIdx].caption}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
