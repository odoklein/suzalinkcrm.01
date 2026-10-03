-- =============================================
-- Captain Prospect CRM - EXTENDED SEED DATA
-- Run this AFTER seed-data.sql in Supabase SQL Editor
-- Preserves existing users, adds more test data
-- =============================================

-- =============================================
-- ADDITIONAL COMPANIES (20 more with varied completeness)
-- =============================================

INSERT INTO "Company" ("id", "listId", "name", "country", "industry", "website", "size", "status", "updatedAt") VALUES
-- ACTIONABLE (complete data)
('company-004', 'list-001', 'FinanceFlow', 'France', 'FinTech', 'https://financeflow.fr', '50-100', 'ACTIONABLE', NOW()),
('company-005', 'list-001', 'EcoTech Solutions', 'France', 'GreenTech', 'https://ecotech.fr', '20-50', 'ACTIONABLE', NOW()),
('company-006', 'list-001', 'DataViz Pro', 'France', 'Analytics', 'https://datavizpro.fr', '10-20', 'ACTIONABLE', NOW()),
('company-007', 'list-001', 'CyberGuard', 'France', 'Cybersecurity', 'https://cyberguard.fr', '100-200', 'ACTIONABLE', NOW()),
('company-008', 'list-001', 'MedTech AI', 'France', 'HealthTech', 'https://medtechai.fr', '20-50', 'ACTIONABLE', NOW()),
('company-009', 'list-001', 'LogiSmart', 'France', 'Logistics', 'https://logismart.fr', '50-100', 'ACTIONABLE', NOW()),
('company-010', 'list-001', 'EdLearn Pro', 'France', 'EdTech', 'https://edlearnpro.fr', '10-20', 'ACTIONABLE', NOW()),

-- PARTIAL (some data missing)
('company-011', 'list-001', 'AgriTech Plus', 'France', 'AgriTech', NULL, '20-50', 'PARTIAL', NOW()),
('company-012', 'list-001', 'RetailMax', 'France', 'Retail', NULL, NULL, 'PARTIAL', NOW()),
('company-013', 'list-001', 'PropTech Hub', 'France', 'PropTech', 'https://proptechhub.fr', NULL, 'PARTIAL', NOW()),
('company-014', 'list-001', 'HRFlow', 'France', 'HRTech', NULL, NULL, 'PARTIAL', NOW()),
('company-015', 'list-001', 'LegalTech Pro', 'France', NULL, NULL, '10-20', 'PARTIAL', NOW()),
('company-016', 'list-001', 'ConstructoTech', 'France', 'Construction', NULL, NULL, 'PARTIAL', NOW()),

-- INCOMPLETE (minimal data)
('company-017', 'list-001', 'StartupXYZ', 'France', NULL, NULL, NULL, 'INCOMPLETE', NOW()),
('company-018', 'list-001', 'TechVenture', NULL, NULL, NULL, NULL, 'INCOMPLETE', NOW()),
('company-019', 'list-001', 'InnoLab', 'France', NULL, NULL, NULL, 'INCOMPLETE', NOW()),
('company-020', 'list-001', 'FutureTech', NULL, NULL, NULL, NULL, 'INCOMPLETE', NOW()),
('company-021', 'list-001', 'SmartSolutions', 'France', NULL, NULL, NULL, 'INCOMPLETE', NOW()),
('company-022', 'list-001', 'DigitalFirst', NULL, NULL, NULL, NULL, 'INCOMPLETE', NOW()),
('company-023', 'list-001', 'NextGenTech', 'France', NULL, NULL, NULL, 'INCOMPLETE', NOW())
ON CONFLICT ("id") DO NOTHING;

-- =============================================
-- ADDITIONAL CONTACTS (50 with varied quality)
-- =============================================

INSERT INTO "Contact" ("id", "companyId", "firstName", "lastName", "title", "email", "phone", "linkedin", "status", "updatedAt") VALUES
-- ACTIONABLE contacts (full data)
('contact-004', 'company-004', 'Laurent', 'Bernard', 'CEO', 'laurent@financeflow.fr', '+33 6 45 67 89 01', 'linkedin.com/in/lbernard', 'ACTIONABLE', NOW()),
('contact-005', 'company-004', 'Claire', 'Moreau', 'CTO', 'claire@financeflow.fr', '+33 6 56 78 90 12', 'linkedin.com/in/cmoreau', 'ACTIONABLE', NOW()),
('contact-006', 'company-005', 'Marc', 'Duval', 'CEO', 'marc@ecotech.fr', '+33 6 67 89 01 23', 'linkedin.com/in/mduval', 'ACTIONABLE', NOW()),
('contact-007', 'company-005', 'Julie', 'Petit', 'CMO', 'julie@ecotech.fr', '+33 6 78 90 12 34', NULL, 'ACTIONABLE', NOW()),
('contact-008', 'company-006', 'François', 'Roux', 'Founder', 'francois@datavizpro.fr', '+33 6 89 01 23 45', 'linkedin.com/in/froux', 'ACTIONABLE', NOW()),
('contact-009', 'company-007', 'Emilie', 'Simon', 'CISO', 'emilie@cyberguard.fr', '+33 6 90 12 34 56', 'linkedin.com/in/esimon', 'ACTIONABLE', NOW()),
('contact-010', 'company-007', 'Nicolas', 'Leroy', 'CEO', 'nicolas@cyberguard.fr', '+33 6 01 23 45 67', 'linkedin.com/in/nleroy', 'ACTIONABLE', NOW()),
('contact-011', 'company-008', 'Catherine', 'Girard', 'CEO', 'catherine@medtechai.fr', '+33 6 12 34 56 78', 'linkedin.com/in/cgirard', 'ACTIONABLE', NOW()),
('contact-012', 'company-009', 'Philippe', 'Bonnet', 'COO', 'philippe@logismart.fr', '+33 6 23 45 67 89', NULL, 'ACTIONABLE', NOW()),
('contact-013', 'company-010', 'Anne', 'Michel', 'CEO', 'anne@edlearnpro.fr', '+33 6 34 56 78 90', 'linkedin.com/in/amichel', 'ACTIONABLE', NOW()),

-- PARTIAL contacts (some info missing)
('contact-014', 'company-011', 'Thomas', 'Garcia', 'CEO', 'thomas@agritech.fr', NULL, NULL, 'PARTIAL', NOW()),
('contact-015', 'company-011', 'Marie', 'Martinez', 'CTO', NULL, '+33 6 45 67 89 02', NULL, 'PARTIAL', NOW()),
('contact-016', 'company-012', 'Paul', 'Lopez', 'Director', 'paul@retailmax.fr', NULL, NULL, 'PARTIAL', NOW()),
('contact-017', 'company-012', 'Sophie', 'Gonzalez', 'Manager', NULL, NULL, 'linkedin.com/in/sgonzalez', 'PARTIAL', NOW()),
('contact-018', 'company-013', 'Jean', 'Wilson', 'CEO', 'jean@proptech.fr', NULL, NULL, 'PARTIAL', NOW()),
('contact-019', 'company-014', 'Isabelle', 'Anderson', 'HR Director', NULL, '+33 6 56 78 90 13', NULL, 'PARTIAL', NOW()),
('contact-020', 'company-014', 'Robert', 'Thomas', 'CTO', 'robert@hrflow.fr', NULL, NULL, 'PARTIAL', NOW()),
('contact-021', 'company-015', 'Nathalie', 'Jackson', 'Founder', NULL, '+33 6 67 89 01 24', NULL, 'PARTIAL', NOW()),
('contact-022', 'company-016', 'Michel', 'White', 'CEO', 'michel@constructo.fr', NULL, NULL, 'PARTIAL', NOW()),
('contact-023', 'company-001', 'Alexandre', 'Harris', 'VP Sales', NULL, '+33 6 78 90 12 35', NULL, 'PARTIAL', NOW()),

-- INCOMPLETE contacts (minimal data)
('contact-024', 'company-017', 'Denis', 'Martin', NULL, NULL, NULL, NULL, 'INCOMPLETE', NOW()),
('contact-025', 'company-017', NULL, 'Standard', 'Reception', NULL, '+33 1 23 45 67 89', NULL, 'INCOMPLETE', NOW()),
('contact-026', 'company-018', 'Eric', NULL, 'Manager', NULL, NULL, NULL, 'INCOMPLETE', NOW()),
('contact-027', 'company-018', NULL, NULL, NULL, 'contact@techventure.fr', NULL, NULL, 'INCOMPLETE', NOW()),
('contact-028', 'company-019', 'Sylvie', 'Brown', NULL, NULL, NULL, NULL, 'INCOMPLETE', NOW()),
('contact-029', 'company-020', NULL, NULL, 'CEO', NULL, '+33 1 34 56 78 90', NULL, 'INCOMPLETE', NOW()),
('contact-030', 'company-020', 'Patrick', NULL, NULL, NULL, NULL, 'linkedin.com/in/patrick', 'INCOMPLETE', NOW()),
('contact-031', 'company-021', NULL, 'Contact', NULL, 'info@smartsolutions.fr', NULL, NULL, 'INCOMPLETE', NOW()),
('contact-032', 'company-022', 'Olivier', 'Davis', NULL, NULL, NULL, NULL, 'INCOMPLETE', NOW()),
('contact-033', 'company-023', NULL, NULL, NULL, NULL, '+33 1 45 67 89 01', NULL, 'INCOMPLETE', NOW()),

-- Additional contacts for existing companies  
('contact-034', 'company-002', 'Luc', 'Fontaine', 'VP Engineering', 'luc@dataflow.com', '+33 6 11 22 33 44', 'linkedin.com/in/lfontaine', 'ACTIONABLE', NOW()),
('contact-035', 'company-002', 'Camille', 'Rousseau', 'Product Manager', 'camille@dataflow.com', '+33 6 22 33 44 55', NULL, 'ACTIONABLE', NOW()),
('contact-036', 'company-003', 'Vincent', 'Chevalier', 'CEO', 'vincent@cloudnine.com', '+33 6 33 44 55 66', 'linkedin.com/in/vchevalier', 'ACTIONABLE', NOW()),
('contact-037', 'company-001', 'Aurélie', 'Faure', 'CFO', 'aurelie@innovatech.com', '+33 6 44 55 66 77', NULL, 'ACTIONABLE', NOW()),

-- More ACTIONABLE for testing queue
('contact-038', 'company-004', 'Benjamin', 'Mercier', 'VP Sales', 'benjamin@financeflow.fr', '+33 6 55 66 77 88', 'linkedin.com/in/bmercier', 'ACTIONABLE', NOW()),
('contact-039', 'company-005', 'Charlotte', 'Legrand', 'COO', 'charlotte@ecotech.fr', '+33 6 66 77 88 99', NULL, 'ACTIONABLE', NOW()),
('contact-040', 'company-006', 'David', 'Garnier', 'Sales Director', 'david@datavizpro.fr', '+33 6 77 88 99 00', 'linkedin.com/in/dgarnier', 'ACTIONABLE', NOW()),
('contact-041', 'company-007', 'Elise', 'Perrin', 'VP Product', 'elise@cyberguard.fr', '+33 6 88 99 00 11', NULL, 'ACTIONABLE', NOW()),
('contact-042', 'company-008', 'Fabien', 'Robin', 'CTO', 'fabien@medtechai.fr', '+33 6 99 00 11 22', 'linkedin.com/in/frobin', 'ACTIONABLE', NOW()),
('contact-043', 'company-009', 'Gaelle', 'Muller', 'CEO', 'gaelle@logismart.fr', '+33 6 00 11 22 33', 'linkedin.com/in/gmuller', 'ACTIONABLE', NOW()),

-- More PARTIAL contacts
('contact-044', 'company-010', 'Hugo', 'Lefevre', 'CTO', NULL, '+33 6 11 22 33 00', NULL, 'PARTIAL', NOW()),
('contact-045', 'company-011', 'Ines', 'Clement', 'Sales', 'ines@agritech.fr', NULL, NULL, 'PARTIAL', NOW()),
('contact-046', 'company-012', 'Jules', 'Dubois', 'Manager', NULL, '+33 6 22 33 44 00', NULL, 'PARTIAL', NOW()),
('contact-047', 'company-013', 'Lea', 'Fournier', 'CEO', 'lea@proptechhub.fr', NULL, NULL, 'PARTIAL', NOW()),
('contact-048', 'company-014', 'Martin', 'Morel', 'HR Manager', NULL, NULL, 'linkedin.com/in/mmorel', 'PARTIAL', NOW()),
('contact-049', 'company-015', 'Nina', 'Laurent', 'Partner', 'nina@legaltech.fr', NULL, NULL, 'PARTIAL', NOW()),
('contact-050', 'company-016', 'Oscar', 'Giraud', 'Director', NULL, '+33 6 33 44 55 00', NULL, 'PARTIAL', NOW()),
('contact-051', 'company-001', 'Pauline', 'Andre', 'Sales Rep', 'pauline@innovatech.com', NULL, NULL, 'PARTIAL', NOW()),
('contact-052', 'company-002', 'Quentin', 'Lecomte', 'Developer', NULL, NULL, 'linkedin.com/in/qlecomte', 'PARTIAL', NOW()),
('contact-053', 'company-003', 'Rose', 'Fernandez', 'Marketing', 'rose@cloudnine.com', NULL, NULL, 'PARTIAL', NOW())
ON CONFLICT ("id") DO NOTHING;

-- =============================================
-- SAMPLE ACTIONS (30 historical actions)
-- =============================================

INSERT INTO "Action" ("id", "contactId", "sdrId", "campaignId", "channel", "result", "note", "duration", "createdAt") VALUES
-- Week 1 actions (older)
('action-001', 'contact-001', 'sdr-001', 'campaign-001', 'CALL', 'NO_RESPONSE', 'Pas de réponse, messagerie vocale', 45, NOW() - INTERVAL '14 days'),
('action-002', 'contact-002', 'sdr-001', 'campaign-001', 'CALL', 'INTERESTED', 'Intéressé par une démo, rappeler la semaine prochaine', 180, NOW() - INTERVAL '14 days'),
('action-003', 'contact-003', 'sdr-001', 'campaign-001', 'CALL', 'BAD_CONTACT', 'A quitté l''entreprise', 30, NOW() - INTERVAL '13 days'),
('action-004', 'contact-004', 'sdr-001', 'campaign-001', 'CALL', 'CALLBACK_REQUESTED', 'En réunion, rappeler jeudi 14h', 60, NOW() - INTERVAL '13 days'),
('action-005', 'contact-005', 'sdr-001', 'campaign-001', 'CALL', 'MEETING_BOOKED', 'RDV confirmé pour le 20/01 à 10h', 300, NOW() - INTERVAL '12 days'),

-- Week 2 actions
('action-006', 'contact-006', 'sdr-001', 'campaign-001', 'CALL', 'DISQUALIFIED', 'Déjà équipé, pas intéressé', 120, NOW() - INTERVAL '11 days'),
('action-007', 'contact-007', 'sdr-001', 'campaign-001', 'CALL', 'NO_RESPONSE', NULL, 30, NOW() - INTERVAL '11 days'),
('action-008', 'contact-008', 'sdr-001', 'campaign-001', 'CALL', 'INTERESTED', 'Besoin identifié, budget Q2', 240, NOW() - INTERVAL '10 days'),
('action-009', 'contact-009', 'sdr-001', 'campaign-001', 'CALL', 'NO_RESPONSE', 'Numéro incorrect', 15, NOW() - INTERVAL '10 days'),
('action-010', 'contact-010', 'sdr-001', 'campaign-001', 'CALL', 'CALLBACK_REQUESTED', 'Rappeler lundi matin', 90, NOW() - INTERVAL '9 days'),

-- Week 3 actions (more recent)
('action-011', 'contact-011', 'sdr-001', 'campaign-001', 'CALL', 'NO_RESPONSE', NULL, 20, NOW() - INTERVAL '8 days'),
('action-012', 'contact-012', 'sdr-001', 'campaign-001', 'CALL', 'BAD_CONTACT', 'Mauvais numéro', 10, NOW() - INTERVAL '7 days'),
('action-013', 'contact-013', 'sdr-001', 'campaign-001', 'CALL', 'INTERESTED', 'Très intéressé, envoyer documentation', 210, NOW() - INTERVAL '7 days'),
('action-014', 'contact-014', 'sdr-001', 'campaign-001', 'CALL', 'NO_RESPONSE', NULL, 25, NOW() - INTERVAL '6 days'),
('action-015', 'contact-015', 'sdr-001', 'campaign-001', 'CALL', 'MEETING_BOOKED', 'RDV confirmé 25/01 11h', 280, NOW() - INTERVAL '6 days'),

-- Recent actions (last week)
('action-016', 'contact-016', 'sdr-001', 'campaign-001', 'CALL', 'NO_RESPONSE', NULL, 30, NOW() - INTERVAL '5 days'),
('action-017', 'contact-017', 'sdr-001', 'campaign-001', 'CALL', 'DISQUALIFIED', 'Entreprise en liquidation', 60, NOW() - INTERVAL '5 days'),
('action-018', 'contact-018', 'sdr-001', 'campaign-001', 'CALL', 'CALLBACK_REQUESTED', 'Rappeler vendredi', 45, NOW() - INTERVAL '4 days'),
('action-019', 'contact-019', 'sdr-001', 'campaign-001', 'CALL', 'NO_RESPONSE', NULL, 20, NOW() - INTERVAL '4 days'),
('action-020', 'contact-020', 'sdr-001', 'campaign-001', 'CALL', 'INTERESTED', 'Projet en cours, timing parfait', 200, NOW() - INTERVAL '3 days'),

-- Very recent actions
('action-021', 'contact-034', 'sdr-001', 'campaign-001', 'CALL', 'NO_RESPONSE', NULL, 25, NOW() - INTERVAL '2 days'),
('action-022', 'contact-035', 'sdr-001', 'campaign-001', 'CALL', 'MEETING_BOOKED', 'Démo planifiée 28/01', 320, NOW() - INTERVAL '2 days'),
('action-023', 'contact-036', 'sdr-001', 'campaign-001', 'CALL', 'NO_RESPONSE', 'Messagerie pleine', 15, NOW() - INTERVAL '1 day'),
('action-024', 'contact-037', 'sdr-001', 'campaign-001', 'CALL', 'CALLBACK_REQUESTED', 'Rappeler demain 9h', 75, NOW() - INTERVAL '1 day'),
('action-025', 'contact-038', 'sdr-001', 'campaign-001', 'CALL', 'INTERESTED', 'Budget validé, décision ce mois', 250, NOW() - INTERVAL '1 day'),

-- Today actions
('action-026', 'contact-039', 'sdr-001', 'campaign-001', 'CALL', 'NO_RESPONSE', NULL, 30, NOW() - INTERVAL '2 hours'),
('action-027', 'contact-040', 'sdr-001', 'campaign-001', 'CALL', 'DISQUALIFIED', 'Trop petit budget', 90, NOW() - INTERVAL '1 hour'),
('action-028', 'contact-041', 'sdr-001', 'campaign-001', 'CALL', 'NO_RESPONSE', NULL, 20, NOW() - INTERVAL '45 minutes'),
('action-029', 'contact-042', 'sdr-001', 'campaign-001', 'CALL', 'INTERESTED', 'Souhaite plus d''infos par email', 180, NOW() - INTERVAL '30 minutes'),
('action-030', 'contact-043', 'sdr-001', 'campaign-001', 'CALL', 'MEETING_BOOKED', 'RDV confirmé aujourd''hui 16h!', 360, NOW() - INTERVAL '15 minutes')
ON CONFLICT ("id") DO NOTHING;

-- =============================================
-- SAMPLE OPPORTUNITIES (5 from successful actions)
-- =============================================

INSERT INTO "Opportunity" ("id", "contactId", "companyId", "needSummary", "urgency", "estimatedMin", "estimatedMax", "handedOff", "handedOffAt", "notes", "updatedAt") VALUES
('opp-001', 'contact-005', 'company-004', 'Recherche solution de gestion financière SaaS pour équipe de 30 personnes. Budget prévu Q1 2026. Décideur final = CEO.', 'SHORT', 15000, 25000, true, NOW() - INTERVAL '10 days', 'Client très motivé, démo effectuée', NOW()),
('opp-002', 'contact-008', 'company-008', 'Besoin d''automatisation des processus médicaux. Projet de transformation digitale en cours. Timeline: 6 mois.', 'MEDIUM', 50000, 80000, true, NOW() - INTERVAL '5 days', 'Gros potentiel, appel de découverte planifié', NOW()),
('opp-003', 'contact-013', 'company-013', 'Intérêt pour solution PropTech. Comparaison avec 2 autres fournisseurs en cours.', 'SHORT', 8000, 12000, false, NULL, 'Envoyer documentation technique', NOW()),
('opp-004', 'contact-020', 'company-014', 'Projet RH: digitalisation du recrutement. Budget non encore défini mais priorité haute.', 'MEDIUM', 20000, 35000, false, NULL, 'Qualifier le budget exact', NOW()),
('opp-005', 'contact-025', 'company-004', 'Extension du contrat initial. Déploiement sur 2 autres filiales européennes.', 'LONG', 40000, 60000, false, NULL, 'Upsell sur client existant', NOW())
ON CONFLICT ("id") DO NOTHING;

-- =============================================
-- SUMMARY
-- =============================================
-- Companies: 23 total (7 ACTIONABLE, 6 PARTIAL, 7 INCOMPLETE + 3 original)
-- Contacts: 53 total (24 ACTIONABLE, 16 PARTIAL, 10 INCOMPLETE + 3 original)
-- Actions: 30 historical actions over 2 weeks
-- Opportunities: 5 (2 handed off, 3 pending)
-- =============================================
