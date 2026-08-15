-- ============================================================
-- SCHÉMA SUPABASE / POSTGRESQL
-- Application de gestion de devis, bons de commande et facturation
-- progressive — intégration QuickBooks — conformité Loi 25
-- ============================================================

-- ============================================================
-- 1. EXTENSIONS
-- ============================================================
create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";

-- ============================================================
-- 2. GESTION DE LA CLÉ DE CHIFFREMENT (AES-256 via pgp_sym_encrypt)
-- ------------------------------------------------------------
-- EN PRODUCTION : ne jamais coder la clé en dur. Utiliser Supabase
-- Vault (extension "supabase_vault") et récupérer le secret via
-- vault.decrypted_secrets. Ici on prépare une fonction wrapper
-- pour centraliser l'accès à la clé.
-- ============================================================
create or replace function get_encryption_key()
returns text
language sql
security definer
as $$
  -- À remplacer en prod par :
  -- select decrypted_secret from vault.decrypted_secrets where name = 'client_data_key';
  select current_setting('app.encryption_key', true);
$$;

create or replace function encrypt_data(data text)
returns bytea
language sql
security definer
as $$
  select case when data is null then null
    else pgp_sym_encrypt(data, get_encryption_key(), 'cipher-algo=aes256')
  end;
$$;

create or replace function decrypt_data(data bytea)
returns text
language sql
security definer
as $$
  select case when data is null then null
    else pgp_sym_decrypt(data, get_encryption_key())
  end;
$$;

-- ============================================================
-- 3. TABLE CLIENTS
-- ============================================================
create table clients (
  id uuid primary key default uuid_generate_v4(),
  nom_entreprise text not null,
  contact_principal text,
  -- Champs sensibles chiffrés AES-256 (Loi 25)
  courriel_chiffre bytea,
  telephone_chiffre bytea,
  no_compte_chiffre bytea,
  quickbooks_customer_id text unique,
  actif boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references auth.users(id)
);

comment on column clients.courriel_chiffre is 'Chiffré AES-256 (pgp_sym_encrypt) — Loi 25';
comment on column clients.telephone_chiffre is 'Chiffré AES-256 (pgp_sym_encrypt) — Loi 25';

-- ============================================================
-- 4. TABLE ADRESSES DE LIVRAISON (multi-adresses par client)
-- ============================================================
create table adresses_livraison (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  nom_adresse text, -- ex: "Entrepôt principal", "Chantier Nord"
  adresse_ligne1_chiffree bytea not null,
  adresse_ligne2_chiffree bytea,
  ville text,
  province text default 'QC',
  code_postal_chiffre bytea,
  est_defaut boolean default false,
  created_at timestamptz default now()
);

create index idx_adresses_client on adresses_livraison(client_id);

-- Une seule adresse par défaut par client
create unique index idx_une_adresse_defaut
  on adresses_livraison(client_id)
  where est_defaut = true;

-- ============================================================
-- 5. TABLE PRODUITS (synchronisée QuickBooks)
-- ============================================================
create table produits (
  id uuid primary key default uuid_generate_v4(),
  quickbooks_item_id text unique,
  sku text,
  nom text not null,
  description text,
  prix_vendant numeric(12,2) not null default 0,
  prix_coutant numeric(12,2) not null default 0,
  unite text default 'unité',
  taxable boolean default true,
  actif boolean default true,
  derniere_sync_qb timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on column produits.prix_coutant is 'Coût interne — jamais exposé aux devis/factures client';

-- ============================================================
-- 6. TABLE PROJETS (fil conducteur devis → BC → factures)
-- ============================================================
create table projets (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id),
  nom_projet text not null,
  statut text default 'en_cours'
    check (statut in ('en_cours','complete','annule','en_attente')),
  adresse_livraison_id uuid references adresses_livraison(id),
  created_at timestamptz default now(),
  created_by uuid references auth.users(id)
);

create index idx_projets_client on projets(client_id);

-- ============================================================
-- 7. DEVIS
-- ============================================================
create table devis (
  id uuid primary key default uuid_generate_v4(),
  numero_devis text unique not null,
  projet_id uuid references projets(id),
  client_id uuid not null references clients(id),
  adresse_livraison_id uuid references adresses_livraison(id),
  statut text default 'brouillon'
    check (statut in ('brouillon','envoye','accepte','refuse','expire')),
  date_emission date default current_date,
  date_validite date,
  sous_total numeric(12,2) default 0,
  taxes numeric(12,2) default 0,
  total numeric(12,2) default 0,
  notes text,
  created_at timestamptz default now(),
  created_by uuid references auth.users(id)
);

create table devis_lignes (
  id uuid primary key default uuid_generate_v4(),
  devis_id uuid not null references devis(id) on delete cascade,
  produit_id uuid references produits(id),
  description text,
  quantite numeric(10,2) not null default 1,
  prix_unitaire numeric(12,2) not null,
  montant_ligne numeric(12,2) generated always as (quantite * prix_unitaire) stored,
  ordre integer default 0
);

-- ============================================================
-- 8. BONS DE COMMANDE
-- ============================================================
create table bons_commande (
  id uuid primary key default uuid_generate_v4(),
  numero_bc text unique not null,
  devis_id uuid references devis(id),
  projet_id uuid not null references projets(id),
  client_id uuid not null references clients(id),
  adresse_livraison_id uuid references adresses_livraison(id),
  statut text default 'ouvert'
    check (statut in ('ouvert','en_cours','termine','annule')),
  date_creation date default current_date,
  montant_total numeric(12,2) default 0,
  created_at timestamptz default now(),
  created_by uuid references auth.users(id)
);

create table bons_commande_lignes (
  id uuid primary key default uuid_generate_v4(),
  bon_commande_id uuid not null references bons_commande(id) on delete cascade,
  produit_id uuid references produits(id),
  description text,
  quantite numeric(10,2) not null default 1,
  prix_unitaire numeric(12,2) not null,
  montant_ligne numeric(12,2) generated always as (quantite * prix_unitaire) stored,
  ordre integer default 0
);

-- ============================================================
-- 9. FACTURES (facturation progressive)
-- ============================================================
create table factures (
  id uuid primary key default uuid_generate_v4(),
  numero_facture text unique not null,
  quickbooks_invoice_id text unique,
  bon_commande_id uuid references bons_commande(id),
  projet_id uuid not null references projets(id),
  client_id uuid not null references clients(id),
  type_facturation text default 'complete'
    check (type_facturation in ('complete','partielle','acompte','final')),
  pourcentage_facture numeric(5,2), -- ex: 30.00 pour une facture de 30% du projet
  statut text default 'brouillon'
    check (statut in ('brouillon','envoyee','payee_partielle','payee','en_retard','annulee')),
  date_emission date default current_date,
  date_echeance date,
  sous_total numeric(12,2) default 0,
  taxes numeric(12,2) default 0,
  total numeric(12,2) default 0,
  montant_paye numeric(12,2) default 0,
  created_at timestamptz default now(),
  created_by uuid references auth.users(id)
);

create table factures_lignes (
  id uuid primary key default uuid_generate_v4(),
  facture_id uuid not null references factures(id) on delete cascade,
  produit_id uuid references produits(id),
  description text,
  quantite numeric(10,2) not null default 1,
  prix_unitaire numeric(12,2) not null,
  montant_ligne numeric(12,2) generated always as (quantite * prix_unitaire) stored,
  ordre integer default 0
);

create index idx_factures_projet on factures(projet_id);

-- ============================================================
-- 10. AUDIT LOG (journal secret — Loi 25)
-- ------------------------------------------------------------
-- Table append-only : personne (même les admins applicatifs) ne
-- peut modifier ou supprimer une entrée. Alimentée par triggers.
-- ============================================================
create table audit_log (
  id bigint generated always as identity primary key,
  table_name text not null,
  operation text not null,
  record_id uuid,
  user_id uuid references auth.users(id),
  user_email text,
  donnees_avant jsonb,
  donnees_apres jsonb,
  created_at timestamptz default now()
);

alter table audit_log enable row level security;

-- Aucun rôle applicatif ne peut modifier/supprimer le journal
revoke update, delete on audit_log from authenticated, anon;

-- Seuls les comptes marqués "admin" dans le JWT peuvent le consulter
create policy "Lecture reservee aux admins"
  on audit_log for select
  using (auth.jwt() ->> 'role' = 'admin');

-- Fonction générique de journalisation
create or replace function fn_audit_trigger()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into audit_log(table_name, operation, record_id, user_id, user_email, donnees_avant, donnees_apres)
  values (
    TG_TABLE_NAME,
    TG_OP,
    coalesce(new.id, old.id),
    auth.uid(),
    auth.jwt() ->> 'email',
    case when TG_OP in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when TG_OP in ('UPDATE','INSERT') then to_jsonb(new) else null end
  );
  return coalesce(new, old);
end;
$$;

-- Application du trigger sur toutes les tables sensibles
create trigger trg_audit_clients
  after insert or update or delete on clients
  for each row execute function fn_audit_trigger();

create trigger trg_audit_adresses
  after insert or update or delete on adresses_livraison
  for each row execute function fn_audit_trigger();

create trigger trg_audit_produits
  after insert or update or delete on produits
  for each row execute function fn_audit_trigger();

create trigger trg_audit_devis
  after insert or update or delete on devis
  for each row execute function fn_audit_trigger();

create trigger trg_audit_bons_commande
  after insert or update or delete on bons_commande
  for each row execute function fn_audit_trigger();

create trigger trg_audit_factures
  after insert or update or delete on factures
  for each row execute function fn_audit_trigger();

-- ============================================================
-- 11. ROW LEVEL SECURITY — activation de base sur toutes les tables
-- ------------------------------------------------------------
-- À adapter selon la structure des rôles (ex: multi-succursale).
-- Exemple ici : seuls les utilisateurs authentifiés accèdent aux
-- données ; à affiner avec des policies par rôle/équipe.
-- ============================================================
alter table clients enable row level security;
alter table adresses_livraison enable row level security;
alter table produits enable row level security;
alter table projets enable row level security;
alter table devis enable row level security;
alter table devis_lignes enable row level security;
alter table bons_commande enable row level security;
alter table bons_commande_lignes enable row level security;
alter table factures enable row level security;
alter table factures_lignes enable row level security;

create policy "Utilisateurs authentifies - acces complet"
  on clients for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Répéter des policies équivalentes (ou plus fines par rôle) pour
-- adresses_livraison, produits, projets, devis, devis_lignes,
-- bons_commande, bons_commande_lignes, factures, factures_lignes.

-- ============================================================
-- 12. TRIGGERS updated_at
-- ============================================================
create or replace function fn_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_clients_updated_at
  before update on clients
  for each row execute function fn_set_updated_at();

create trigger trg_produits_updated_at
  before update on produits
  for each row execute function fn_set_updated_at();

-- ============================================================
-- 13. EXTENSION DU SCHÉMA — fonctionnalités ajoutées après la
-- première version (agenda, transport GPS, module Projets enrichi,
-- intégration QuickBooks par projet, comptes techniciens, journal
-- d'activité). Ajouté en continuité du schéma ci-dessus, sans
-- casser les tables existantes.
-- ============================================================

-- ------------------------------------------------------------
-- 13.1 EXTENSION DE LA TABLE PROJETS
-- ------------------------------------------------------------
-- Le module Projets/Rentabilité a besoin d'un budget, d'un taux
-- horaire coûtant, d'une adresse des travaux et de dates — et le
-- statut couvre maintenant le cycle Kanban (À planifier / En cours /
-- Facturation d'acompte / Terminé) plutôt que le cycle générique
-- initial.
alter table projets
  add column if not exists budget_total numeric(12,2) not null default 0,
  add column if not exists taux_horaire_coutant numeric(8,2) not null default 0,
  add column if not exists adresse_travaux text,
  add column if not exists date_debut date,
  add column if not exists date_fin date;

-- Remplace la contrainte de statut par les 4 colonnes Kanban actuelles.
alter table projets drop constraint if exists projets_statut_check;
alter table projets
  add constraint projets_statut_check
  check (statut in ('a_planifier','en_cours','facturation_acompte','termine'));
alter table projets alter column statut set default 'a_planifier';

comment on column projets.budget_total is 'Prix soumissionné au client (HT) — sert de base au calcul de rentabilité';
comment on column projets.taux_horaire_coutant is 'Coût interne par heure de main-d''œuvre (jamais exposé au client)';

-- ------------------------------------------------------------
-- 13.2 EXTENSION DES BONS DE COMMANDE (achats fournisseur)
-- ------------------------------------------------------------
alter table bons_commande
  add column if not exists fournisseur text,
  add column if not exists montant_ht numeric(12,2) not null default 0;

-- ------------------------------------------------------------
-- 13.3 TÂCHES PLANIFIÉES (agenda) — remplace tachesAttente/planning
-- ------------------------------------------------------------
-- Une ligne par tâche, avec assignation optionnelle (employe_id +
-- date + heure). Tant que non assignée, employe_id/date_assignee sont
-- nuls et la tâche apparaît dans "Tâches en attente" côté admin.
create table taches_planifiees (
  id uuid primary key default uuid_generate_v4(),
  titre text,
  client_id uuid references clients(id),
  projet_id uuid references projets(id),
  type_tache text not null default 'appel_service'
    check (type_tache in ('appel_service','devis','temps_materiel','entretien_contrat')),
  statut text not null default 'a_planifier'
    check (statut in ('a_planifier','en_attente_materiel','assignee')),
  description text,
  devis_id uuid references devis(id),
  frequence_facturation_annuelle smallint check (frequence_facturation_annuelle in (3,4)),
  adresse_travaux text,
  heures numeric(5,2) not null default 1 check (heures >= 0),
  jours smallint not null default 0 check (jours >= 0),
  sauter_weekend boolean default false,
  -- Assignation (nulle tant que non planifiée dans l'agenda)
  employe_id uuid references auth.users(id),
  date_assignee date,
  heure_assignee time,
  created_at timestamptz default now(),
  created_by uuid references auth.users(id)
);

create index idx_taches_client on taches_planifiees(client_id);
create index idx_taches_projet on taches_planifiees(projet_id);
create index idx_taches_employe_date on taches_planifiees(employe_id, date_assignee);

-- ------------------------------------------------------------
-- 13.4 TRAVAUX (interventions réalisées ou à venir, avec notes/photos
-- et — pour les entrées de transport — la capture GPS)
-- ------------------------------------------------------------
create table travaux (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id),
  projet_id uuid references projets(id),
  tache_planifiee_id uuid references taches_planifiees(id),
  titre text not null,
  date_intervention date not null default current_date,
  statut text not null default 'a_venir' check (statut in ('a_venir','complete')),
  montant numeric(12,2),
  heures numeric(6,2) default 0,
  est_transport boolean default false,
  -- Notes séparées : note_terrain est visible au client (imprimée sur
  -- le bon de travail), note_interne ne l'est jamais.
  note_terrain text,
  note_interne text,
  -- Capture GPS départ/arrivée (uniquement pour est_transport = true)
  lat_depart double precision,
  lng_depart double precision,
  lat_arrivee double precision,
  lng_arrivee double precision,
  distance_km numeric(6,1),
  heure_depart_gps timestamptz,
  -- Verrouillage de modification post-envoi (délai de 10 minutes)
  envoye boolean default false,
  envoye_a timestamptz,
  modif_reactivee boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_travaux_client on travaux(client_id);
create index idx_travaux_projet on travaux(projet_id);
create index idx_travaux_date on travaux(date_intervention);

comment on column travaux.note_terrain is 'Visible au client sur le bon de travail imprimé';
comment on column travaux.note_interne is 'JAMAIS visible au client — admin/techniciens seulement';

create table travaux_photos (
  id uuid primary key default uuid_generate_v4(),
  travail_id uuid not null references travaux(id) on delete cascade,
  type_photo text not null check (type_photo in ('avant','apres')),
  chemin_stockage text not null, -- chemin dans Supabase Storage, pas l'image elle-même
  taille_originale integer,
  taille_compressee integer,
  created_at timestamptz default now()
);

create table travaux_signatures (
  id uuid primary key default uuid_generate_v4(),
  travail_id uuid not null references travaux(id) on delete cascade,
  nom_signataire text not null,
  chemin_stockage text not null, -- image du tracé, dans Supabase Storage
  est_deuxieme_signature boolean default false, -- réouverture hors délai
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- 13.5 BONS DE TRAVAIL — FACTURATION (onglet Facturation / QuickBooks)
-- ------------------------------------------------------------
-- Distinct de bons_commande (achats fournisseur) : ceci représente un
-- travail complété prêt à être facturé au client via QuickBooks, avec
-- suivi du statut de facturation progressive.
create table bons_travail_facturation (
  id uuid primary key default uuid_generate_v4(),
  travail_id uuid references travaux(id),
  client_id uuid not null references clients(id),
  projet_id uuid references projets(id),
  type_facturation text not null default 'appel_service'
    check (type_facturation in ('appel_service','devis','temps_materiel','entretien_contrat')),
  devis_id uuid references devis(id),
  montant numeric(12,2) not null default 0,
  prix_non_liste boolean default false,
  adresse_travaux text,
  statut_qb text not null default 'en_attente' check (statut_qb in ('en_attente','envoye')),
  created_at timestamptz default now()
);

-- Chaque facture progressive émise contre un bon_travail_facturation —
-- lié 1-N avec la table factures existante pour la ligne comptable.
create table factures_progressives (
  id uuid primary key default uuid_generate_v4(),
  bon_travail_id uuid not null references bons_travail_facturation(id),
  facture_id uuid references factures(id),
  numero_facture_qb text,
  montant numeric(12,2) not null,
  type_calcul text check (type_calcul in ('complete','pourcentage','sur_mesure','echeance')),
  detail text,
  date_emission date default current_date,
  created_at timestamptz default now()
);

create index idx_factures_prog_bon on factures_progressives(bon_travail_id);

-- ------------------------------------------------------------
-- 13.6 TRANSACTIONS QUICKBOOKS (factures/dépenses synchronisées et
-- attribuées automatiquement ou manuellement à un projet)
-- ------------------------------------------------------------
create table transactions_quickbooks (
  id uuid primary key default uuid_generate_v4(),
  quickbooks_id text unique not null,
  type_transaction text not null check (type_transaction in ('INVOICE','EXPENSE')),
  projet_id uuid references projets(id), -- nul tant que non assignée
  customer_ref_id text,
  qb_project_ref text,
  po_number text,
  amount_ht numeric(12,2) not null,
  amount_ttc numeric(12,2),
  status text check (status in ('PAID','UNPAID','DUE')),
  synced_at timestamptz default now(),
  assignee_manuellement_par uuid references auth.users(id)
);

create index idx_qb_transactions_projet on transactions_quickbooks(projet_id);

comment on column transactions_quickbooks.qb_project_ref is 'ProjectRef brut QuickBooks — distinct de projet_id (notre résolution)';

-- ------------------------------------------------------------
-- 13.7 PROFILS UTILISATEURS APPLICATIFS (technicien/admin)
-- ------------------------------------------------------------
-- Distinct de auth.users (géré par Supabase Auth) : porte les
-- informations métier (poste, type d'accès, notes RH) liées à un
-- compte d'authentification.
create table profils_utilisateurs (
  id uuid primary key references auth.users(id) on delete cascade,
  nom text not null,
  nom_utilisateur text unique not null,
  telephone_chiffre bytea,
  courriel text,
  type_acces text not null default 'Employé'
    check (type_acces in ('Administrateur','Employé','Chargé de projet')),
  poste text,
  date_embauche date,
  adresse text,
  notes_rh text,
  created_at timestamptz default now()
);

comment on column profils_utilisateurs.notes_rh is 'Visible admin seulement — jamais exposé côté technicien';

-- ------------------------------------------------------------
-- 13.8 JOURNAL D'ACTIVITÉ (fil d'automatisation — distinct de
-- audit_log qui, lui, capture chaque UPDATE/INSERT/DELETE brut)
-- ------------------------------------------------------------
-- Ce journal est lisible par les admins dans l'interface (feed
-- humain : "Client X créé et transféré vers QuickBooks"), alors que
-- audit_log est un journal technique avant/après pour la conformité.
create table journal_activite (
  id bigint generated always as identity primary key,
  texte text not null,
  created_at timestamptz default now(),
  created_by uuid references auth.users(id)
);

alter table journal_activite enable row level security;
revoke update, delete on journal_activite from authenticated, anon;
create policy "Lecture reservee aux authentifies"
  on journal_activite for select
  using (auth.role() = 'authenticated');
create policy "Insertion reservee aux authentifies"
  on journal_activite for insert
  with check (auth.role() = 'authenticated');

-- ------------------------------------------------------------
-- 13.9 ROW LEVEL SECURITY — nouvelles tables
-- ------------------------------------------------------------
alter table taches_planifiees enable row level security;
alter table travaux enable row level security;
alter table travaux_photos enable row level security;
alter table travaux_signatures enable row level security;
alter table bons_travail_facturation enable row level security;
alter table factures_progressives enable row level security;
alter table transactions_quickbooks enable row level security;
alter table profils_utilisateurs enable row level security;

create policy "Authentifies - acces complet" on taches_planifiees for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authentifies - acces complet" on travaux for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authentifies - acces complet" on travaux_photos for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authentifies - acces complet" on travaux_signatures for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authentifies - acces complet" on bons_travail_facturation for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authentifies - acces complet" on factures_progressives for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authentifies - acces complet" on transactions_quickbooks for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Le profil applicatif : chacun voit/modifie le sien, un admin voit tout
create policy "Voir son propre profil" on profils_utilisateurs for select
  using (id = auth.uid() or auth.jwt() ->> 'role' = 'admin');
create policy "Modifier son propre profil ou en tant qu'admin" on profils_utilisateurs for update
  using (id = auth.uid() or auth.jwt() ->> 'role' = 'admin');
create policy "Admin seul peut creer un profil" on profils_utilisateurs for insert
  with check (auth.jwt() ->> 'role' = 'admin');

-- Notes RH : colonne visible seulement aux admins — à faire respecter
-- via une vue restreinte pour les rôles non-admin plutôt qu'une policy
-- au niveau ligne (RLS ne masque pas des colonnes individuelles).
create view profils_utilisateurs_public as
  select id, nom, nom_utilisateur, courriel, type_acces, poste, date_embauche
  from profils_utilisateurs;

-- ------------------------------------------------------------
-- 13.10 TRIGGERS D'AUDIT — nouvelles tables sensibles
-- ------------------------------------------------------------
create trigger trg_audit_travaux
  after insert or update or delete on travaux
  for each row execute function fn_audit_trigger();

create trigger trg_audit_bons_travail_facturation
  after insert or update or delete on bons_travail_facturation
  for each row execute function fn_audit_trigger();

create trigger trg_audit_profils_utilisateurs
  after insert or update or delete on profils_utilisateurs
  for each row execute function fn_audit_trigger();

create trigger trg_travaux_updated_at
  before update on travaux
  for each row execute function fn_set_updated_at();

-- ------------------------------------------------------------
-- 13.11 REALTIME — active la réplication logique pour les tables
-- que les deux apps doivent voir se synchroniser en direct
-- ------------------------------------------------------------
alter publication supabase_realtime add table taches_planifiees;
alter publication supabase_realtime add table travaux;
alter publication supabase_realtime add table projets;
alter publication supabase_realtime add table bons_travail_facturation;
alter publication supabase_realtime add table journal_activite;

-- ============================================================
-- 14. INSPECTIONS JOURNALIÈRES DES VÉHICULES
-- ============================================================
-- Une fiche par technicien et par jour, déclenchée au 1er trajet
-- (« Transport — Début de journée »). Le km relevé alimente aussi le
-- suivi d'entretien périodique (voir entretiens_vehicules).
create table if not exists inspections_vehicules (
  id                   uuid primary key default gen_random_uuid(),
  date_inspection      date not null default current_date,
  technicien_id        uuid references profils_utilisateurs(id) on delete set null,
  technicien_nom       text,                 -- identité simple en mode test (avant le lien profils)
  technicien_email     text,
  sans_vehicule        boolean not null default false,
  numero_camion        text,                 -- saisie libre (autocomplétion côté app)
  kilometrage          integer,
  -- État des contrôles : { "pneus":"ok"|"probleme", "freins":..., "fluides":...,
  --                        "bruit_moteur":..., "lumieres":..., "carrosserie":... }
  controles            jsonb not null default '{}'::jsonb,
  remarque_anomalie    text,
  photo_url            text,
  a_anomalie           boolean not null default false,
  -- Suivi de l'anomalie côté admin : 'aucune' | 'nouvelle' | 'prise_en_charge'
  statut_anomalie      text not null default 'aucune'
                         check (statut_anomalie in ('aucune','nouvelle','prise_en_charge')),
  note_prise_en_charge text,                 -- action effectuée (obligatoire à la prise en charge)
  pris_en_charge_par   uuid references profils_utilisateurs(id) on delete set null,
  pris_en_charge_par_nom text,
  pris_en_charge_le    timestamptz,
  created_at           timestamptz not null default now(),
  unique (technicien_id, date_inspection)    -- une seule fiche par technicien par jour
);

create index if not exists idx_inspections_date on inspections_vehicules (date_inspection desc);
create index if not exists idx_inspections_camion on inspections_vehicules (numero_camion);
create index if not exists idx_inspections_anomalie on inspections_vehicules (statut_anomalie) where a_anomalie;

alter table inspections_vehicules enable row level security;

-- Mode TEST : tout utilisateur connecté peut lire/écrire (durcissement
-- par rôle prévu avant la mise en production).
create policy "inspections_lecture_test" on inspections_vehicules
  for select to authenticated using (true);
create policy "inspections_ecriture_test" on inspections_vehicules
  for all to authenticated using (true) with check (true);

-- ============================================================
-- 15. ENTRETIEN PÉRIODIQUE DES VÉHICULES
-- ============================================================
-- Journal des entretiens réalisés. Le prochain entretien est dû au
-- PREMIER des deux seuils atteint : +10 000 km OU +6 mois depuis le
-- dernier entretien du camion (km courant lu dans inspections_vehicules).
create table if not exists entretiens_vehicules (
  id             uuid primary key default gen_random_uuid(),
  numero_camion  text not null,
  kilometrage    integer not null,           -- km au moment de l'entretien
  date_entretien date not null default current_date,
  note           text,
  fait_par       uuid references profils_utilisateurs(id) on delete set null,
  created_at     timestamptz not null default now()
);

create index if not exists idx_entretiens_camion on entretiens_vehicules (numero_camion, date_entretien desc);

alter table entretiens_vehicules enable row level security;

create policy "entretiens_lecture_test" on entretiens_vehicules
  for select to authenticated using (true);
create policy "entretiens_ecriture_test" on entretiens_vehicules
  for all to authenticated using (true) with check (true);

-- Règle applicative : SEUIL_KM = 10000 · SEUIL_MOIS = 6

create trigger trg_audit_inspections_vehicules
  after insert or update or delete on inspections_vehicules
  for each row execute function fn_audit_trigger();

alter publication supabase_realtime add table inspections_vehicules;
alter publication supabase_realtime add table entretiens_vehicules;

-- ============================================================
-- 15b. TÂCHES ASSIGNÉES (pont agenda admin -> app technicien)
-- ============================================================
-- Une ligne par (tâche, technicien) : l'agenda admin écrit ici à chaque
-- assignation, l'app technicien lit les lignes de SON courriel (+
-- Realtime). Le technicien est identifié par courriel en mode test —
-- lien vers profils_utilisateurs au durcissement pré-production.
create table if not exists taches_assignees (
  id            uuid primary key default gen_random_uuid(),
  tache_id      text not null,           -- id de la tâche côté agenda
  employe_email text not null,
  employe_nom   text,
  titre         text,
  client_nom    text,
  description   text,
  type_tache    text,
  date_debut    date not null,
  heure_debut   text,
  heures        integer,
  jours         integer,
  statut        text not null default 'planifiee',
  donnees       jsonb,                   -- fiche complète (reconstruction fidèle de l'agenda)
  created_at    timestamptz not null default now(),
  unique (tache_id, employe_email)
);

create index if not exists idx_taches_assignees_email on taches_assignees (employe_email, date_debut);

alter table taches_assignees enable row level security;

drop policy if exists "taches_assignees_lecture_test" on taches_assignees;
drop policy if exists "taches_assignees_ecriture_test" on taches_assignees;
create policy "taches_assignees_lecture_test" on taches_assignees
  for select to authenticated using (true);
create policy "taches_assignees_ecriture_test" on taches_assignees
  for all to authenticated using (true) with check (true);

alter publication supabase_realtime add table taches_assignees;

-- Lien projet sur les tâches assignées (alimente les coûts réels).
alter table taches_assignees add column if not exists projet_id text;

-- ============================================================
-- 15f. DÉPÔTS PRÉALABLES (appels de service, devis, prospects)
-- ============================================================
-- Un dépôt par tâche. Tant qu'il n'est pas payé (ou payé manuellement),
-- la tâche reste bloquée hors agenda. Passé 24 h sans paiement, il passe
-- automatiquement à 'annule_delai'. Les champs qbo_* sont prêts pour la
-- Phase 4 (facture de dépôt QuickBooks + webhook de paiement).
create table if not exists depots (
  tache_id             text primary key,
  statut               text not null default 'en_attente_paiement'
                         check (statut in ('non_requis','en_attente_paiement','paye','paye_manuellement','annule_delai')),
  montant_ht           numeric not null default 0,
  qbo_depot_invoice_id text,
  date_limite          timestamptz not null,
  is_prospect          boolean not null default false,
  prospect_nom         text,
  prospect_courriel    text,
  prospect_telephone   text,
  prospect_adresse     text,
  mode_paiement        text,      -- Comptant | Chèque | Interac (déblocage manuel)
  paye_le              timestamptz,
  paye_par             text,      -- traçabilité : qui a confirmé le paiement
  created_at           timestamptz not null default now()
);

alter table depots enable row level security;

drop policy if exists "depots_lecture_test" on depots;
drop policy if exists "depots_ecriture_test" on depots;
create policy "depots_lecture_test" on depots
  for select to authenticated using (true);
create policy "depots_ecriture_test" on depots
  for all to authenticated using (true) with check (true);

do $$ begin
  alter publication supabase_realtime add table depots;
exception when duplicate_object then null;
end $$;

-- ============================================================
-- 15g. LISTE DE PRIX — DÉPÔTS D'APPELS DE SERVICE (par zone)
-- ============================================================
-- Zones 1/2/3 à prix fixes (modifiables par l'Admin principal) ;
-- « hors zone » = tarif sur mesure saisi à la création de la tâche.
create table if not exists prix_depots (
  zone       text primary key,
  montant_ht numeric not null default 0
);

alter table prix_depots enable row level security;

drop policy if exists "prix_depots_lecture_test" on prix_depots;
drop policy if exists "prix_depots_ecriture_test" on prix_depots;
create policy "prix_depots_lecture_test" on prix_depots
  for select to authenticated using (true);
create policy "prix_depots_ecriture_test" on prix_depots
  for all to authenticated using (true) with check (true);

-- ============================================================
-- 15d. GRILLE DES TAUX HORAIRES COÛTANTS (métier × niveau)
-- ============================================================
create table if not exists taux_metiers (
  metier text not null,
  niveau text not null,
  taux   numeric not null default 0,
  primary key (metier, niveau)
);

alter table taux_metiers enable row level security;

drop policy if exists "taux_lecture_test" on taux_metiers;
drop policy if exists "taux_ecriture_test" on taux_metiers;
create policy "taux_lecture_test" on taux_metiers
  for select to authenticated using (true);
create policy "taux_ecriture_test" on taux_metiers
  for all to authenticated using (true) with check (true);

-- ============================================================
-- 15e. TRAVAUX EFFECTUÉS (terrain -> bureau, coûts réels)
-- ============================================================
-- Une ligne par tâche terminée par un technicien. `taux_coutant_fige`
-- = taux du métier/niveau AU MOMENT de la saisie (jamais recalculé —
-- spec contrôle de gestion : une augmentation ne réécrit pas le passé).
create table if not exists travaux_effectues (
  id               uuid primary key default gen_random_uuid(),
  tache_id         text not null,
  employe_email    text,
  employe_nom      text,
  titre            text,
  client_nom       text,
  date_travail     date not null,
  heures           numeric not null default 0,
  est_transport    boolean not null default false,
  kilometres       numeric,
  projet_id        text,
  note_terrain     text,
  -- Note INTERNE du technicien : jamais visible au client — affichée au
  -- bureau (agenda) pour répondre vite quand le client rappelle.
  note_interne     text,
  taux_coutant_fige numeric,
  -- Heures RÉELLES de début et de fin de la tâche (capturées par l'app
  -- technicien au premier Débuter et au Terminer).
  debut_reel       timestamptz,
  fin_reelle       timestamptz,
  -- Proposition d'ajustement d'heures par un RÉPARTITEUR — en attente de
  -- validation par un administrateur (l'heure officielle reste `heures`
  -- tant que la proposition n'est pas validée). Les lignes d'une même
  -- correction partagent un groupe_proposition (validées ensemble).
  heures_proposees numeric,
  proposition_par  text,
  proposition_le   timestamptz,
  debut_propose    timestamptz,
  fin_propose      timestamptz,
  groupe_proposition text,
  -- Correction TARDIVE (appliquée/validée APRÈS la fin de la semaine de
  -- paie de la ligne) : la différence (heures - heures_avant_correction)
  -- est REPORTÉE sur la semaine de paie de la correction (colonne
  -- « Report ± » de l'onglet Heures de la semaine).
  corrige_le       timestamptz,
  heures_avant_correction numeric,
  created_at       timestamptz not null default now(),
  unique (tache_id, employe_email)
);

create index if not exists idx_travaux_effectues_projet on travaux_effectues (projet_id);

alter table travaux_effectues enable row level security;

drop policy if exists "travaux_eff_lecture_test" on travaux_effectues;
drop policy if exists "travaux_eff_ecriture_test" on travaux_effectues;
create policy "travaux_eff_lecture_test" on travaux_effectues
  for select to authenticated using (true);
create policy "travaux_eff_ecriture_test" on travaux_effectues
  for all to authenticated using (true) with check (true);

do $$ begin
  alter publication supabase_realtime add table travaux_effectues;
exception when duplicate_object then null;
end $$;

-- ============================================================
-- 15c. RÉPERTOIRE DES EMPLOYÉS (mode test — persistance du dossier
-- Utilisateurs de l'admin, alimente l'agenda et la synchro des tâches)
-- ============================================================
-- Découplé de auth.users pour le mode test ; migration vers
-- profils_utilisateurs (lié aux comptes) au durcissement pré-production.
create table if not exists repertoire_employes (
  id                text primary key,
  nom               text not null,
  courriel          text,
  telephone         text,
  nom_utilisateur   text,
  type_acces        text,
  metier            text,
  niveau            text,
  -- Taux horaire INDIVIDUEL (métiers de bureau : adjointe, chargé de
  -- projet, estimateur, répartiteur, directeur) et PRIME horaire
  -- individuelle (métiers de terrain — s'ajoute à la grille CCQ).
  taux_horaire      numeric,
  prime_horaire     numeric,
  poste             text,
  date_embauche     text,
  adresse           text,
  notes_rh          text,
  mot_de_passe_cree boolean default false,
  created_at        timestamptz not null default now()
);

alter table repertoire_employes enable row level security;

drop policy if exists "repertoire_lecture_test" on repertoire_employes;
drop policy if exists "repertoire_ecriture_test" on repertoire_employes;
create policy "repertoire_lecture_test" on repertoire_employes
  for select to authenticated using (true);
create policy "repertoire_ecriture_test" on repertoire_employes
  for all to authenticated using (true) with check (true);

-- ============================================================
-- 16. PERMISSIONS PAR UTILISATEUR (couche 3 du contrôle d'accès)
-- ============================================================
-- L'Admin principal peut personnaliser les accès de chaque utilisateur
-- (rôle + liste de sections cochées) par-dessus les défauts du rôle.
-- `sections` à null = utiliser les défauts du rôle (lib/permissions.js).
create table if not exists permissions_utilisateurs (
  email      text primary key,
  role       text not null default 'Technicien',
  -- Sous-catégorie du rôle « Administration bureau » (= métier de bureau :
  -- Adjointe administrative, Chargé de projet, Estimateur, Répartiteur,
  -- Directeur) — fixe les accès par défaut ; null pour les autres rôles.
  sous_categorie text,
  sections   jsonb,               -- ex: ["clients","agenda","inspections"] ; null = défauts du rôle
  updated_at timestamptz not null default now()
);

alter table permissions_utilisateurs enable row level security;

-- Mode TEST : tout utilisateur connecté peut lire ; l'écriture sera
-- restreinte à l'Admin principal lors du durcissement pré-production.
create policy "permissions_lecture_authentifiee" on permissions_utilisateurs
  for select to authenticated using (true);
create policy "permissions_ecriture_authentifiee_test" on permissions_utilisateurs
  for all to authenticated using (true) with check (true);

-- ============================================================
-- 17. BONS DE TRAVAIL SIGNÉS SUR LE TERRAIN (snippet « 16 »)
-- ============================================================
-- Quand le technicien clique « Terminer et envoyer » : le bon signé part
-- au(x) courriel(s) choisi(s) du client (envoi simulé en mode test) et
-- devient une DEMANDE DE FACTURATION dans l'onglet Facturation.
create table if not exists bons_travail (
  id               uuid primary key default gen_random_uuid(),
  tache_id         text not null,
  employe_email    text not null,
  employe_nom      text,
  titre            text,
  client_nom       text,
  description      text,
  date_travail     date not null,
  heures           numeric not null default 0,
  type_tache       text,
  devis_numero     text,
  adresse_travaux  text,
  projet_id        text,
  photos           jsonb,          -- { avant: [urls], apres: [urls] }
  courriels_envoi  jsonb,          -- destinataires choisis (choix multiple)
  signe_par_nom    text,
  envoye_le        timestamptz not null default now(),
  statut_facturation text not null default 'a_facturer',
  created_at       timestamptz not null default now(),
  unique (tache_id, employe_email)
);

alter table bons_travail enable row level security;
drop policy if exists "bons_lecture_test" on bons_travail;
drop policy if exists "bons_ecriture_test" on bons_travail;
create policy "bons_lecture_test" on bons_travail
  for select to authenticated using (true);
create policy "bons_ecriture_test" on bons_travail
  for all to authenticated using (true) with check (true);

alter publication supabase_realtime add table bons_travail;

-- ============================================================
-- 18. RÉPERTOIRE DES FOURNISSEURS (snippet « 17 »)
-- ============================================================
-- Matériaux, location d'équipement, sous-traitance. Permet d'envoyer le
-- bon de commande directement au fournisseur depuis l'app (plusieurs
-- adresses courriel possibles : achats, comptabilité, représentant).
create table if not exists fournisseurs (
  id         text primary key,
  nom        text not null,
  courriels  jsonb,          -- [{ id, email, label, defaut }]
  telephone  text,
  adresse    text,
  notes      text,
  created_at timestamptz not null default now()
);

alter table fournisseurs enable row level security;
drop policy if exists "fournisseurs_lecture_test" on fournisseurs;
drop policy if exists "fournisseurs_ecriture_test" on fournisseurs;
create policy "fournisseurs_lecture_test" on fournisseurs
  for select to authenticated using (true);
create policy "fournisseurs_ecriture_test" on fournisseurs
  for all to authenticated using (true) with check (true);

-- ============================================================
-- 19. PARC DE VÉHICULES (snippet « 18 »)
-- ============================================================
-- Répertoire officiel des camions. Le technicien CHOISIT son véhicule
-- dans cette liste (plus de saisie libre = plus de camions fantômes
-- créés par une faute de frappe). Un camion retiré du parc passe à
-- actif = false : il disparaît de la liste du technicien mais reste
-- dans l'historique des inspections et des entretiens.
create table if not exists camions (
  id             text primary key,
  nom            text not null,
  immatriculation text,
  marque_modele  text,
  annee          text,
  actif          boolean not null default true,
  notes          text,
  -- Retrait du parc (vente, remplacement, bris majeur) : le dossier
  -- reste consultable dans « Anciens véhicules » avec son historique.
  retire_le      date,
  motif_retrait  text,
  remplace_par   text,
  created_at     timestamptz not null default now()
);

alter table camions enable row level security;
drop policy if exists "camions_lecture_test" on camions;
drop policy if exists "camions_ecriture_test" on camions;
create policy "camions_lecture_test" on camions
  for select to authenticated using (true);
create policy "camions_ecriture_test" on camions
  for all to authenticated using (true) with check (true);

-- ============================================================
-- 20. CARNET D'ENTRETIEN DU PARC (snippet « 19 »)
-- ============================================================
-- Trace de TOUT ce qui a été fait sur chaque camion : réparations
-- (suite à une anomalie d'inspection) et entretiens périodiques.
-- Les coûts servent au suivi du parc, PAS à la rentabilité des projets.
create table if not exists carnet_vehicules (
  id            uuid primary key default gen_random_uuid(),
  camion        text not null,
  type          text not null check (type in ('reparation','entretien')),
  date_travaux  date not null default current_date,
  description   text,
  cout          numeric(12,2),
  garage        text,
  kilometrage   numeric,
  inspection_id uuid,               -- anomalie d'origine (réparations)
  par_nom       text,
  created_at    timestamptz not null default now()
);

create index if not exists idx_carnet_camion on carnet_vehicules(camion);

alter table carnet_vehicules enable row level security;
drop policy if exists "carnet_lecture_test" on carnet_vehicules;
drop policy if exists "carnet_ecriture_test" on carnet_vehicules;
create policy "carnet_lecture_test" on carnet_vehicules
  for select to authenticated using (true);
create policy "carnet_ecriture_test" on carnet_vehicules
  for all to authenticated using (true) with check (true);

alter publication supabase_realtime add table carnet_vehicules;

-- ============================================================
-- 21. COMPTEURS DE NUMÉROTATION (snippet « 20 »)
-- ============================================================
-- Numérotation SÉQUENTIELLE et sans doublon des documents créés dans
-- l'application : devis (DEV-####) et bons de commande (BC-####).
-- La séquence est continue à l'infini : 9999 -> 10000 -> 10001 ...
--
-- Les numéros de FACTURE ne sont PAS gérés ici : ils viennent de
-- QuickBooks (séquence comptable officielle exigée par Revenu Québec).
create table if not exists compteurs (
  cle    text primary key,
  valeur bigint not null default 0
);

-- Valeurs de DÉPART — le prochain numéro émis sera « valeur + 1 ».
-- Ajuste ces nombres avant d'exécuter pour continuer une série existante.
insert into compteurs (cle, valeur) values ('devis', 3499) on conflict (cle) do nothing;
insert into compteurs (cle, valeur) values ('bon_commande', 999) on conflict (cle) do nothing;

-- Incrémente et retourne le prochain numéro EN UNE SEULE OPÉRATION —
-- c'est ce qui rend un doublon impossible, même si deux personnes
-- créent un document au même instant.
create or replace function prochain_numero(cle_compteur text)
returns bigint
language plpgsql
security definer
as $$
declare
  nouveau bigint;
begin
  insert into compteurs (cle, valeur) values (cle_compteur, 1)
  on conflict (cle) do update set valeur = compteurs.valeur + 1
  returning valeur into nouveau;
  return nouveau;
end;
$$;

alter table compteurs enable row level security;
drop policy if exists "compteurs_lecture_test" on compteurs;
create policy "compteurs_lecture_test" on compteurs
  for select to authenticated using (true);
grant execute on function prochain_numero(text) to authenticated;

-- ============================================================
-- 22. DEVIS DE L'APPLICATION + VERSIONS (snippet « 21 »)
-- ============================================================
-- Persistance des devis (soumissions). Table nommée `devis_app` pour ne
-- pas entrer en conflit avec la table `devis` du schéma initial (section 7).
--
-- VERSIONS : toutes les révisions d'un même dossier partagent
-- `numero_base` (ex. DEV-3500) ; `numero` porte le suffixe de révision
-- (DEV-3500-1, DEV-3500-2). Une seule version_active à la fois — les
-- autres restent consultables en lecture seule.
create table if not exists devis_app (
  id                    text primary key,
  numero                text not null,
  numero_base           text not null,
  version               integer not null default 0,
  version_active        boolean not null default true,
  client_id             text,
  client_nom            text,
  lignes                jsonb not null default '[]'::jsonb,
  total_coutant         numeric(12,2) not null default 0,
  total_vendant         numeric(12,2) not null default 0,
  statut                text not null default 'envoye',
  date_emission         date not null default current_date,
  courriel_envoi        text,
  courriels_envoi       jsonb,
  est_contrat           boolean not null default false,
  frequence_facturation integer,
  note_version          text,
  traite                boolean not null default false,
  mode_traitement       text,
  projet_id             text,
  created_at            timestamptz not null default now()
);

create index if not exists idx_devis_app_base on devis_app(numero_base);

alter table devis_app enable row level security;
drop policy if exists "devis_app_lecture_test" on devis_app;
drop policy if exists "devis_app_ecriture_test" on devis_app;
create policy "devis_app_lecture_test" on devis_app
  for select to authenticated using (true);
create policy "devis_app_ecriture_test" on devis_app
  for all to authenticated using (true) with check (true);

alter publication supabase_realtime add table devis_app;

-- ============================================================
-- 23. CLIENTS · PROJETS · TÂCHES EN ATTENTE · JOURNAL (snippet « 22 »)
-- ============================================================
-- Ces quatre-là ne survivaient pas au rechargement de la page.
-- Tables suffixées `_app` là où le schéma initial portait déjà un nom
-- (modèles chiffrés jamais mis en place).

create table if not exists clients_app (
  id                     text primary key,
  nom                    text not null,
  entreprise             text,
  courriels              jsonb not null default '[]'::jsonb,
  telephone              text,
  terme_facturation      text,
  adresse_facturation    text,
  adresses               jsonb not null default '[]'::jsonb,
  quickbooks_customer_id text,
  sync_qb                text,
  created_at             timestamptz not null default now()
);

create table if not exists projets_app (
  id                   text primary key,
  client_id            text,
  nom                  text not null,
  date_debut           date,
  date_fin             date,
  statut               text not null default 'a_planifier',
  adresse_livraison    text,
  budget_total         numeric(12,2) not null default 0,
  taux_horaire_coutant numeric(10,2) not null default 0,
  budget_prevu         jsonb,
  bons_commande        jsonb not null default '[]'::jsonb,
  created_at           timestamptz not null default now()
);

create index if not exists idx_projets_app_client on projets_app(client_id);

create table if not exists taches_attente (
  id         text primary key,
  titre      text,
  client_nom text,
  type_tache text,
  donnees    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- JOURNAL D'AUDIT — append-only : on ajoute, on ne modifie ni ne
-- supprime jamais (exigence de traçabilité, Loi 25).
create table if not exists journal_activite (
  id          uuid primary key default gen_random_uuid(),
  texte       text not null,
  par_nom     text,
  date_locale date,
  heure_locale text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_journal_date on journal_activite(created_at desc);

alter table clients_app enable row level security;
alter table projets_app enable row level security;
alter table taches_attente enable row level security;
alter table journal_activite enable row level security;

drop policy if exists "clients_app_test" on clients_app;
drop policy if exists "projets_app_test" on projets_app;
drop policy if exists "taches_attente_test" on taches_attente;
drop policy if exists "journal_lecture_test" on journal_activite;
drop policy if exists "journal_ajout_test" on journal_activite;

create policy "clients_app_test" on clients_app
  for all to authenticated using (true) with check (true);
create policy "projets_app_test" on projets_app
  for all to authenticated using (true) with check (true);
create policy "taches_attente_test" on taches_attente
  for all to authenticated using (true) with check (true);
-- Journal : lecture + ajout seulement (jamais de modification/suppression)
create policy "journal_lecture_test" on journal_activite
  for select to authenticated using (true);
create policy "journal_ajout_test" on journal_activite
  for insert to authenticated with check (true);

alter publication supabase_realtime add table clients_app;
alter publication supabase_realtime add table projets_app;
alter publication supabase_realtime add table taches_attente;

-- ============================================================
-- 24. CONFIGURATION DE L'ENTREPRISE (snippet « 23 »)
-- ============================================================
-- Coordonnées, numéros officiels, taux de taxes et règles de paie —
-- avant, tout cela était écrit en dur dans le code.
--
-- CONÇU MULTI-ENTREPRISES : une ligne par entreprise. Aujourd'hui une
-- seule (Ventilation DGL) ; pour en ajouter d'autres plus tard, il
-- suffira de rattacher chaque utilisateur à la sienne et de resserrer
-- les politiques d'accès (RLS) pour cloisonner les données.
create table if not exists entreprises (
  id                    text primary key,
  nom_legal             text not null,
  nom_commercial        text,
  adresse               text,
  telephone             text,
  telephone_urgence     text,
  courriel              text,
  courriel_facturation  text,
  site_web              text,
  -- Numéros officiels (Québec)
  numero_tps            text,
  numero_tvq            text,
  numero_rbq            text,
  numero_neq            text,
  membre_cmmtq          boolean not null default true,
  -- Taux de taxes en POURCENTAGE (5 = 5 %) — ajustables si la loi change
  taux_tps              numeric(6,3) not null default 5,
  taux_tvq              numeric(6,3) not null default 9.975,
  terme_paiement_defaut text,
  note_facture          text,
  -- Règles de paie
  seuil_heures_supp     numeric(5,2) not null default 40,
  minutes_diner         integer not null default 30,
  heure_bascule_nuit    integer not null default 16,
  premier_jour_semaine  integer not null default 0,  -- 0 = dimanche
  created_at            timestamptz not null default now()
);

-- Configuration de départ (valeurs actuellement codées en dur).
insert into entreprises (
  id, nom_legal, adresse, telephone, courriel,
  numero_tps, numero_tvq, numero_rbq, membre_cmmtq
) values (
  'dgl', 'Ventilation DGL inc.', '771 Boul Industriel, Blainville QC J7C 3V3',
  '(450) 543-9855', 'info@ventilationdgl.com',
  '710702689 RT0001', '1226324573 TQ0001', '5768-7014-01', true
) on conflict (id) do nothing;

alter table entreprises enable row level security;
drop policy if exists "entreprises_lecture_test" on entreprises;
drop policy if exists "entreprises_ecriture_test" on entreprises;
-- Lecture : tout utilisateur connecté (l'en-tête des documents en a besoin).
create policy "entreprises_lecture_test" on entreprises
  for select to authenticated using (true);
-- Écriture : à restreindre à l'Admin principal au durcissement.
create policy "entreprises_ecriture_test" on entreprises
  for all to authenticated using (true) with check (true);

-- ============================================================
-- 25. JOURNÉE BLOQUÉE — CHRONO OUBLIÉ (snippet « 25 »)
-- ============================================================
-- Quand le chrono d'un technicien dépasse le plafond (16 h), sa tâche
-- se ferme SEULE et sa journée est BLOQUÉE : elle ne compte dans
-- aucun total des « Heures de la semaine » tant qu'un administrateur
-- n'a pas appelé le technicien pour obtenir ses vraies heures.
--
-- Le drapeau vit sur la ligne fautive ; l'écran considère toute la
-- JOURNÉE de ce technicien comme bloquée dès qu'une de ses lignes le
-- porte. L'administrateur corrige, puis débloque explicitement.
alter table travaux_effectues
  add column if not exists jour_bloque   boolean not null default false,
  add column if not exists bloque_raison text;

-- Retrouve vite les journées à débloquer.
create index if not exists idx_travaux_effectues_bloques
  on travaux_effectues (employe_email, date_travail)
  where jour_bloque;

-- ============================================================
-- 26. PHOTOS D'INSPECTION DE VÉHICULE (snippet « 28 »)
-- ============================================================
-- Le bouton « Ajouter une photo » de l'inspection ne faisait
-- qu'inverser un booléen : il affichait « Photo ajoutée ✓ » sans
-- qu'aucune caméra ne s'ouvre. Le bureau recevait une anomalie
-- (« feu arrière grillé ») sans jamais pouvoir la voir.
--
-- La colonne `photo_url` existait mais n'était jamais écrite, et une
-- seule photo ne suffit pas pour documenter un bris — on passe donc à
-- un tableau de liens, comme pour les bons de travail.
alter table inspections_vehicules
  add column if not exists photos jsonb not null default '[]'::jsonb;

-- ============================================================
-- 27. ACCEPTATION DU DEVIS PAR LE CLIENT (snippet « 29 »)
-- ============================================================
-- Page PUBLIQUE : le client ouvre un lien sans mot de passe, lit les
-- conditions, coche une case OBLIGATOIRE, et répond.
--
-- ------------------------------------------------------------
-- POURQUOI DEUX FONCTIONS PLUTÔT QU'UN ACCÈS ANONYME À LA TABLE
-- ------------------------------------------------------------
-- Ouvrir `devis_app` en lecture anonyme laisserait fuir les PRIX
-- COÛTANTS et permettrait d'énumérer tous les devis. À la place :
-- deux fonctions `security definer` qui ne rendent que le strict
-- nécessaire. La table reste fermée à toute personne non connectée.
alter table devis_app
  add column if not exists jeton_public        text,
  add column if not exists jeton_expire_le     timestamptz,
  -- Preuve d'acceptation
  add column if not exists reponse_client      text,     -- accepte | refuse | modification
  add column if not exists repondu_le          timestamptz,
  add column if not exists repondu_par_nom     text,
  add column if not exists message_client      text,
  add column if not exists conditions_version  text,     -- version des clauses affichées
  add column if not exists conditions_texte    text;     -- texte EXACT montré ce jour-là

create unique index if not exists idx_devis_jeton
  on devis_app (jeton_public) where jeton_public is not null;

-- ---- LECTURE PUBLIQUE : jamais les coûts ----
create or replace function devis_public(p_jeton text)
returns table (
  numero text, client_nom text, date_emission date,
  lignes jsonb, total_vendant numeric,
  statut text, reponse_client text, repondu_le timestamptz, expire boolean
)
language sql security definer set search_path = public as $$
  select
    d.numero, d.client_nom, d.date_emission,
    -- Les lignes sont RECONSTRUITES sans prix_coutant : le coûtant ne
    -- peut pas fuir, même par erreur de programmation côté page.
    (select coalesce(jsonb_agg(jsonb_build_object(
        'uid', l->>'uid', 'nom', l->>'nom', 'description', l->>'description',
        'quantite', l->'quantite', 'prix_vendant', l->'prix_vendant')), '[]'::jsonb)
     from jsonb_array_elements(d.lignes) l),
    d.total_vendant, d.statut, d.reponse_client, d.repondu_le,
    (d.jeton_expire_le is not null and d.jeton_expire_le < now())
  from devis_app d
  where d.jeton_public = p_jeton and d.version_active;
$$;

-- ---- RÉPONSE DU CLIENT ----
-- Une seule réponse possible : on ne réécrit jamais une acceptation.
create or replace function repondre_devis(
  p_jeton text, p_reponse text, p_nom text,
  p_message text default null, p_version text default null, p_texte text default null
) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_ok boolean;
begin
  if p_reponse not in ('accepte','refuse','modification') then return false; end if;
  if coalesce(trim(p_nom), '') = '' then return false; end if;
  update devis_app set
    reponse_client = p_reponse,
    repondu_le = now(),
    repondu_par_nom = trim(p_nom),
    message_client = nullif(trim(coalesce(p_message,'')), ''),
    conditions_version = p_version,
    conditions_texte = p_texte,
    statut = case when p_reponse = 'accepte' then 'accepte' else statut end
  where jeton_public = p_jeton
    and version_active
    and reponse_client is null                    -- jamais deux fois
    and (jeton_expire_le is null or jeton_expire_le > now())
  returning true into v_ok;
  return coalesce(v_ok, false);
end;
$$;

revoke all on function devis_public(text) from public;
revoke all on function repondre_devis(text,text,text,text,text,text) from public;
grant execute on function devis_public(text) to anon, authenticated;
grant execute on function repondre_devis(text,text,text,text,text,text) to anon, authenticated;

-- ============================================================
-- 28. CATÉGORIE DES HEURES (snippet « 30 »)
-- ============================================================
-- Où le temps atterrit dans les COÛTS :
--   'projet'        → coût direct du projet (comportement historique)
--   'administratif' → frais généraux (visites de chantier / soumission
--                     faites par l'administration, souvent sans contrat
--                     au bout)
--   'divers'        → payé au technicien, mais rattaché à rien
--
-- La paie ne change pas : toutes ces heures restent dues. C'est
-- uniquement l'imputation au coût des projets qui diffère — sans ça,
-- une visite de soumission gonflait le coût d'un projet qu'on n'avait
-- peut-être même pas encore vendu.
alter table travaux_effectues
  add column if not exists categorie_heures text not null default 'projet';

create index if not exists idx_travaux_categorie
  on travaux_effectues (categorie_heures) where categorie_heures <> 'projet';

-- ============================================================
-- 29. PIÈCES À COMMANDER + REGISTRE D'ÉQUIPEMENTS (snippet « 31 »)
-- ============================================================
-- Le technicien diagnostique, il manque une pièce. La réparation
-- attend. Cette table suit la pièce de la découverte à la réception.
--
-- ------------------------------------------------------------
-- LE DÉBLOCAGE EST TOUJOURS HUMAIN
-- ------------------------------------------------------------
-- La facture du fournisseur entrée dans QuickBooks (phase 4) ne
-- débloque RIEN : elle lève une alerte « vérifie avec le magasinier ».
-- Un fournisseur peut facturer à l'expédition, la saisie peut traîner,
-- une livraison peut être partielle. Seule la personne qui a la pièce
-- dans les mains confirme — c'est `recu_le` qui débloque, jamais la
-- facture.
create table if not exists pieces_commandees (
  id                 uuid primary key default gen_random_uuid(),
  -- Appel de service où le besoin a été constaté.
  tache_origine_id   text,
  -- Tâche de RETOUR (2e appel de service, facturé) créée en attente.
  tache_retour_id    text,
  client_id          text,
  client_nom         text,
  -- Unité concernée — alimente aussi le registre d'équipements du client.
  modele             text,
  numero_serie       text,
  piece_requise      text not null,
  note               text,
  -- Achat
  fournisseur_id     text,
  fournisseur_nom    text,
  numero_bc          text,
  numero_facture_fournisseur text,   -- rempli par QuickBooks en phase 4
  -- a_commander -> commandee -> facture_recue -> recue | annulee
  statut             text not null default 'a_commander'
                       check (statut in ('a_commander','commandee','facture_recue','recue','annulee')),
  -- Paiement du client AVANT de replanifier (même logique que les
  -- dépôts d'appels de service : on ne pose pas une pièce de 800 $
  -- avant d'avoir été payé).
  paiement_requis    boolean not null default false,
  paiement_recu      boolean not null default false,
  montant_piece      numeric(12,2),
  -- Réception : qui, quand, et par quel chemin.
  recu_le            timestamptz,
  recu_par_nom       text,
  recu_via           text check (recu_via in ('manuel','quickbooks')),
  annule_le          timestamptz,
  annule_raison      text,
  demande_par_nom    text,
  created_at         timestamptz not null default now()
);

create index if not exists idx_pieces_statut on pieces_commandees (statut)
  where statut not in ('recue','annulee');

alter table pieces_commandees enable row level security;
drop policy if exists "pieces_commandees_test" on pieces_commandees;
create policy "pieces_commandees_test" on pieces_commandees
  for all to authenticated using (true) with check (true);

-- ---- REGISTRE D'ÉQUIPEMENTS DU CLIENT ----
-- Modèle et numéro de série saisis sur chaque appel de service. Se
-- remplit tout seul, et sert bien au-delà des pièces : partir avec la
-- bonne pièce, cibler l'entretien préventif, retrouver les clients
-- touchés par un rappel de fabricant.
alter table clients_app
  add column if not exists equipements jsonb not null default '[]'::jsonb;

-- Champs remontés par le bon de travail : unité vérifiée et pièce
-- manquante (snippet « 31 », suite).
alter table bons_travail
  add column if not exists modele_unite      text,
  add column if not exists serie_unite       text,
  add column if not exists piece_a_commander boolean not null default false,
  add column if not exists piece_requise     text;

-- Plusieurs unités par intervention (immeuble à 3 rooftops) — snippet « 31 ».
alter table bons_travail add column if not exists unites jsonb not null default '[]'::jsonb;
alter table pieces_commandees add column if not exists unites jsonb not null default '[]'::jsonb;

-- Date de réception PRÉVUE (snippet « 31 »). Facultative : bien des
-- fournisseurs ne s'engagent sur rien. Quand elle existe, elle permet
-- de rappeler le client d'avance au lieu d'attendre la boîte.
alter table pieces_commandees add column if not exists date_reception_prevue date;

-- ============================================================
-- SNIPPET « 32 » — camions, passagers, paiement avant commande
-- ============================================================
-- Bloc 2 : trace de l'envoi du bon de commande au fournisseur.
alter table pieces_commandees add column if not exists bc_envoye_le timestamptz;
-- Bloc 3 : le client doit payer la pièce AVANT qu'on la commande.
alter table pieces_commandees add column if not exists paiement_avant_commande boolean not null default false;
-- Bloc 6 : passager d'un camion conduit par un collègue (pas d'inspection
-- à faire — un camion, une inspection, celle du conducteur).
alter table inspections_vehicules add column if not exists passager_de_nom text;
alter table inspections_vehicules add column if not exists passager_de_email text;
-- Bloc 5 : coût horaire du camion FIGÉ le matin de l'inspection — si le
-- tarif change l'an prochain, les vieilles journées gardent leur taux.
alter table inspections_vehicules add column if not exists cout_camion_horaire numeric;
-- Réglage entreprise : coût du camion ($/h), modifiable dans Paramètres.
alter table entreprises add column if not exists cout_camion_horaire numeric;

-- SNIPPET « 33 » — trace de la demande de paiement envoyée au client
-- pour une pièce (avant commande ou avant planification).
alter table pieces_commandees add column if not exists demande_paiement_le timestamptz;

-- SNIPPET « 34 » — seuil d'alerte de marge (analyse de rentabilité).
alter table entreprises add column if not exists seuil_marge_alerte numeric;

-- SNIPPET « 35 » — début de l'année fiscale (analyse de rentabilité).
alter table entreprises add column if not exists debut_annee_fiscale text;

-- ============================================================
-- SNIPPET « 36 » — livraison demandée (souple ou fixe) et
-- historique des reports de date sur les pièces commandées.
-- ============================================================
-- La date de réception devient une « livraison demandée » qui part
-- dans le courriel au fournisseur. Mode FIXE : l'entrepôt n'a pas de
-- personnel en permanence, quelqu'un se déplace pour recevoir ce
-- jour-là — le fournisseur ne peut pas livrer n'importe quand.
alter table pieces_commandees add column if not exists livraison_fixe boolean not null default false;
-- Chaque changement de date garde une trace { de, a, le, par } :
-- « vous aviez promis le 10, puis le 15… » — c'est ce qui permet de
-- relancer un fournisseur avec des faits, et de savoir qui tient parole.
alter table pieces_commandees add column if not exists reports_date jsonb not null default '[]'::jsonb;

-- ============================================================
-- SNIPPET « 37 » — client absent à la fin des travaux (clause 10).
-- ============================================================
-- Le technicien coche « client absent » au lieu de faire signer : le
-- bon part sans signature, les travaux sont réputés reçus (clause 10
-- des conditions), et la facturation affiche la mention au lieu de
-- l'alerte « bon non signé ».
alter table bons_travail add column if not exists client_absent boolean not null default false;

-- ============================================================
-- SNIPPET « 38 » — connexion QuickBooks (jetons OAuth, Sandbox).
-- ============================================================
-- Les jetons d'accès QuickBooks ne doivent JAMAIS être lisibles depuis
-- le navigateur : RLS activée SANS AUCUNE politique = seule la clé
-- service (serveur Vercel) peut lire/écrire cette table. Une ligne par
-- environnement ('sandbox' puis 'production' en bascule finale).
create table if not exists quickbooks_connexion (
  environnement text primary key check (environnement in ('sandbox','production')),
  realm_id text not null,
  access_token text not null,
  refresh_token text not null,
  access_expire_a timestamptz not null,
  refresh_expire_a timestamptz not null,
  connecte_par text,
  updated_at timestamptz default now()
);
alter table quickbooks_connexion enable row level security;

-- ============================================================
-- SNIPPET « 39 » — nom affiché du client (retours de tests).
-- ============================================================
-- Quand une fiche porte un NOM et une ENTREPRISE, l'admin choisit ce
-- que les listes montrent : 'nom' (défaut), 'entreprise', ou
-- 'nom-entreprise' (les deux).
alter table clients_app add column if not exists nom_affichage text;

-- ============================================================
-- SNIPPET « 43 » — numéro de la facture de dépôt QuickBooks.
-- (43 et non 40 : les numéros 40-41-42 sont occupés dans l'éditeur du
-- propriétaire par des snippets RLS préparés lors d'une validation
-- externe — durcissement / retour arrière / ajustements.)
-- ============================================================
-- L'id QBO existait déjà (qbo_depot_invoice_id) ; on y ajoute le numéro
-- HUMAIN (DocNumber) affiché au bureau et dans le courriel au client.
alter table depots add column if not exists qbo_depot_doc_number text;

-- ============================================================
-- SNIPPET « 44 » — ANNUAIRE EMPLOYÉS (noms + courriels, SANS salaires)
-- ============================================================
-- Ferme proprement la fuite laissée ouverte par le snippet 42 : au lieu
-- de rouvrir toute la table repertoire_employes (qui contient les taux
-- et primes) à l'app technicien, on expose une VUE limitée à 4 colonnes.
-- La vue s'exécute avec les droits de son propriétaire (security_invoker
-- OFF) : elle traverse la RLS de repertoire_employes, mais ne révèle
-- JAMAIS taux_horaire, prime_horaire, notes_rh ou adresse.
-- À exécuter MAINTENANT (ne casse rien — la table reste lisible aussi).
create or replace view public.annuaire_employes as
  select id, nom, courriel, nom_utilisateur
    from public.repertoire_employes;
alter view public.annuaire_employes set (security_invoker = false);
revoke all on public.annuaire_employes from public, anon;
grant select on public.annuaire_employes to authenticated;

-- ============================================================
-- SNIPPET « 45 » — RE-VERROUILLAGE DU RÉPERTOIRE COMPLET
-- ============================================================
-- À exécuter APRÈS la publication du code technicien (qui lit désormais
-- la vue annuaire_employes). Referme repertoire_employes au bureau
-- seulement — les salaires ne sont plus lisibles par un technicien.
-- (L'écriture, elle, est déjà réservée aux admins par le snippet 40.)
drop policy if exists "repertoire_lecture_temporaire" on repertoire_employes;
drop policy if exists "repertoire_lecture_test" on repertoire_employes;
drop policy if exists "repertoire_lecture_bureau" on repertoire_employes;
create policy "repertoire_lecture_bureau" on repertoire_employes
  for select to authenticated using (public.fn_est_bureau());

-- ============================================================
-- SNIPPET « 46 » — attributions manuelles QuickBooks (persistance).
-- ============================================================
-- Mémorise la décision « cette transaction QuickBooks appartient à ce
-- projet » pour qu'elle survive au rafraîchissement. Réservée au bureau
-- (même règle que la facturation). RLS activée AVEC politique bureau —
-- indispensable : une table sans RLS est ouverte à tout le monde.
-- projet_id est en TEXT (et non uuid) : les identifiants de projets_app
-- sont des chaînes de caractères, pas des uuid — pas de clé étrangère
-- typée possible. L'app garde de toute façon la cohérence (elle n'écrit
-- que des id de projets existants).
create table if not exists qb_attributions_manuelles (
  quickbooks_id text primary key,
  projet_id text,
  assignee_par text,
  updated_at timestamptz default now()
);
alter table qb_attributions_manuelles enable row level security;
drop policy if exists "qb_attributions_bureau" on qb_attributions_manuelles;
create policy "qb_attributions_bureau" on qb_attributions_manuelles
  for all to authenticated
  using (public.fn_est_bureau()) with check (public.fn_est_bureau());

-- ============================================================
-- SNIPPET « 47 » — paiements en ligne (QuickBooks Payments)
-- ------------------------------------------------------------
-- Chemin AUTOMATIQUE des appels de service seulement. Défaut : éteint.
-- Le seuil coupe la carte au-dessus du montant (frais de 2,9 % — coût
-- INTERNE du marchand : au Québec, jamais ajouté à la facture client).
-- ============================================================
alter table entreprises add column if not exists paiement_carte_appels boolean not null default false;
alter table entreprises add column if not exists paiement_virement_appels boolean not null default false;
alter table entreprises add column if not exists seuil_carte_appels numeric;

-- ============================================================
-- SNIPPET « 48 » — facturation QuickBooks complète
-- ------------------------------------------------------------
-- 1. Les factures émises d'un bon sont enfin PERSISTÉES (avant :
--    perdues au rechargement de la page — inacceptable avec de vrais
--    numéros QuickBooks dessus).
-- 2. Chaque devis mémorise son « estimate » QuickBooks (le devis vit
--    dans l'application ET dans QuickBooks — pratique du propriétaire).
alter table bons_travail add column if not exists factures_emises jsonb not null default '[]'::jsonb;
alter table devis add column if not exists qbo_estimate_id text;
