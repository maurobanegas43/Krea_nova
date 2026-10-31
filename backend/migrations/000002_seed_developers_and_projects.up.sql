-- 000002_seed_developers_and_projects.up.sql
-- Seed script with 6 Real Estate Developers (Inmobiliarias) and their projects

-- 1. Insert Developer Users & Demo Investor
INSERT INTO users (id, email, phone, password_hash, role, user_type, is_active, created_at, updated_at)
VALUES 
    ('usr-investor-01', 'inversor@kreanova.capital', '+54 9 11 4000-8800', '$2a$12$K1dJ5n7a8Z9v0X1y2W3u4O5p6Q7r8S9t0U1v2W3x4Y5z6A7b8C9d.', 'investor', 'individual', TRUE, NOW(), NOW()),
    ('usr-dev-alpes', 'desarrollo@alpesurban.com.ar', '+54 11 4820-9100', '$2a$12$e8Y6Wz1P0xG7Z8v7F6aHNuK5wP4gK3j8L2m1N0o9P8q7R6s5T4u3V', 'developer', 'corporate', TRUE, NOW(), NOW()),
    ('usr-dev-urban', 'info@urbancapital.com.ar', '+54 11 5238-1400', '$2a$12$e8Y6Wz1P0xG7Z8v7F6aHNuK5wP4gK3j8L2m1N0o9P8q7R6s5T4u3V', 'developer', 'corporate', TRUE, NOW(), NOW()),
    ('usr-dev-nord', 'operaciones@nordlogistics.com.ar', '+54 11 6091-7700', '$2a$12$e8Y6Wz1P0xG7Z8v7F6aHNuK5wP4gK3j8L2m1N0o9P8q7R6s5T4u3V', 'developer', 'corporate', TRUE, NOW(), NOW()),
    ('usr-dev-innovar', 'proyectos@innovarliving.com.ar', '+54 11 4775-8830', '$2a$12$e8Y6Wz1P0xG7Z8v7F6aHNuK5wP4gK3j8L2m1N0o9P8q7R6s5T4u3V', 'developer', 'corporate', TRUE, NOW(), NOW()),
    ('usr-dev-suraustral', 'contacto@suraustral.com.ar', '+54 294 442-8900', '$2a$12$e8Y6Wz1P0xG7Z8v7F6aHNuK5wP4gK3j8L2m1N0o9P8q7R6s5T4u3V', 'developer', 'corporate', TRUE, NOW(), NOW()),
    ('usr-dev-metropolis', 'institucional@metropolisgroup.com.ar', '+54 11 5354-2000', '$2a$12$e8Y6Wz1P0xG7Z8v7F6aHNuK5wP4gK3j8L2m1N0o9P8q7R6s5T4u3V', 'developer', 'corporate', TRUE, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- 2. Insert Developer Profiles (Audited & Verified Inmobiliarias)
INSERT INTO investor_profiles (
    id, user_id, full_name, dni_encrypted, cuil_encrypted, birth_date,
    address_encrypted, city, province, funds_origin, is_pep, is_obligated_subject,
    kyc_status, verified_at
)
VALUES 
    ('prof-investor-01', 'usr-investor-01', 'Inversor Institucional Demo', 'ENC_DNI_DEMO', 'ENC_CUIL_DEMO', '1990-05-15', 'ENC_ADDR_DEMO', 'Buenos Aires', 'CABA', 'Actividad Comercial / Ahorro Inmobiliario', FALSE, FALSE, 'verified', NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO developer_profiles (
    id, user_id, company_name, trade_name, company_type, cuit, registration_number, 
    legal_address, rep_full_name, rep_role, rep_dni_encrypted, rep_cuil_encrypted, 
    ubo_declared, verification_status, verified_at
)
VALUES 
    ('prof-dev-alpes', 'usr-dev-alpes', 'Alpes Desarrollos Urbanos S.A.', 'Alpes Urban', 'SA', '30-71234567-8', 'IGJ-1823901', 'Av. del Libertador 4400, CABA', 'Ing. Matías E. Varela', 'Director de Obras y Apoderado', 'ENC_DNI_VARELA', 'ENC_CUIL_VARELA', TRUE, 'verified', NOW()),
    ('prof-dev-urban', 'usr-dev-urban', 'Urban Capital Partners S.A.S.', 'Urban Capital', 'SAS', '30-71891234-5', 'IGJ-2938471', 'Av. Figueroa Alcorta 3200, Palermo, CABA', 'Arq. Florencia Santillán', 'Socia Gerente & Directora', 'ENC_DNI_SANTILLAN', 'ENC_CUIL_SANTILLAN', TRUE, 'verified', NOW()),
    ('prof-dev-nord', 'usr-dev-nord', 'Nord Logistics Real Estate S.R.L.', 'Nord Industrial & Logistics', 'SRL', '30-70984512-3', 'DPJ-982134', 'Panamericana Ramal Campana Km 72, Buenos Aires', 'Lic. Gonzalo Benítez', 'Director de Operaciones', 'ENC_DNI_BENITEZ', 'ENC_CUIL_BENITEZ', TRUE, 'verified', NOW()),
    ('prof-dev-innovar', 'usr-dev-innovar', 'Innovar PropTech & Living S.A.', 'Innovar Living', 'SA', '30-71556677-2', 'IGJ-4819203', 'Honduras 4800, Palermo Soho, CABA', 'Santiago M. Rossi', 'CEO & Fundador', 'ENC_DNI_ROSSI', 'ENC_CUIL_ROSSI', TRUE, 'verified', NOW()),
    ('prof-dev-suraustral', 'usr-dev-suraustral', 'Sur Austral Desarrollos Inmobiliarios S.A.', 'Sur Austral Real Estate', 'SA', '30-71445566-1', 'RP-RN-77182', 'Av. Bustillo Km 4.2, Bariloche, Río Negro', 'Dr. Lucas E. Méndez', 'Apoderado Legal y Director', 'ENC_DNI_MENDEZ', 'ENC_CUIL_MENDEZ', TRUE, 'verified', NOW()),
    ('prof-dev-metropolis', 'usr-dev-metropolis', 'Metrópolis Hábitat & Retail S.R.L.', 'Metrópolis Group', 'SRL', '30-71667788-9', 'IGJ-3729104', 'Juana Manso 1600, Puerto Madero, CABA', 'Arq. Carolina Beltrán', 'Directora de Arquitectura', 'ENC_DNI_BELTRAN', 'ENC_CUIL_BELTRAN', TRUE, 'verified', NOW())
ON CONFLICT (id) DO NOTHING;

-- 3. Insert Projects Linked to Developers
INSERT INTO projects (id, developer_id, name, location, description, funding_goal, funds_raised, progress, status, created_at, updated_at)
VALUES 
    ('proj-001', 'dev-alpes', 'Torre Krea Nova I', 'Distrito Tecnológico, Buenos Aires', 'Torre corporativa y de micro-living sustentable con certificación LEED Gold.', 75000000, 52500000, 42, 'published', NOW(), NOW()),
    ('proj-002', 'dev-urban', 'Residencias Libertador', 'Núñez, Buenos Aires', 'Complejo residencial exclusivo frente al parque en el corredor más cotizado de la ciudad.', 120000000, 98400000, 68, 'published', NOW(), NOW()),
    ('proj-003', 'dev-nord', 'Parque Logístico Ruta 9', 'Campana, Buenos Aires', 'Naves industriales Triple A con contratos de alquiler a 10 años.', 200000000, 60000000, 15, 'published', NOW(), NOW()),
    ('proj-004', 'dev-innovar', 'Coliving & Studios Palermo', 'Palermo Soho, Buenos Aires', 'Edificio boutique de estudios amoblados para alquiler temporal y nómadas digitales.', 50000000, 0, 5, 'published', NOW(), NOW()),
    ('proj-005', 'dev-suraustral', 'Llao Llao Eco-Residences & Spa', 'Circuito Chico, Bariloche', 'Condo-hotel de montaña y spa termal sustentable en la Patagonia.', 150000000, 45000000, 25, 'published', NOW(), NOW()),
    ('proj-006', 'dev-metropolis', 'Madero Harbour Bay & Residences', 'Dique 2, Puerto Madero, Buenos Aires', 'Torre icónica frente al espejo de agua con zócalo gastronómico y residencias de lujo.', 250000000, 187500000, 55, 'published', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
