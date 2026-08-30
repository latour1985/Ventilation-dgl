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
                         check (statut in ('non_requis','en_attente_paiement','paye','paye_manuellement','annule_delai','annule_qb')),
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

-- ============================================================
-- SNIPPET « 49 » — secteurs COMMERCIAL / RÉSIDENTIEL (CCQ)
-- ------------------------------------------------------------
-- Le même compagnon ne coûte pas le même prix selon le secteur.
-- Chaque tâche porte son secteur (hérité du projet, Commercial par
-- défaut) ; l'heure enregistrée FIGE le taux du bon secteur ; la
-- feuille de temps sépare les heures pour payer correctement.
alter table taux_metiers add column if not exists taux_residentiel numeric;
alter table travaux_effectues add column if not exists secteur text;
alter table projets_app add column if not exists secteur text;
alter table bons_travail add column if not exists secteur text;

-- ============================================================
-- SNIPPET « 50 » — MULTI-ENTREPRISES, PHASE A (additive, SANS DANGER)
-- ------------------------------------------------------------
-- Décision du propriétaire (2026-08-15) : base PARTAGÉE avec isolation
-- RLS — croissance rapide visée (3 partenaires fondateurs, 1 an
-- gratuit, puis prix fondateur).
--
-- Cette phase ne change AUCUN comportement : chaque table reçoit une
-- étiquette d'entreprise avec « dgl » par défaut — l'application
-- actuelle continue d'écrire sans le savoir, et toutes ses lignes
-- (passées et futures) appartiennent à Ventilation DGL. La bascule des
-- règles de sécurité (phase B, « le grand soir ») viendra APRÈS la
-- validation QuickBooks — avec test-sonde d'isolation obligatoire.
--
-- NOTES PHASE B (à ne PAS faire maintenant) :
--   • clés à rendre composites : prix_depots (zone), compteurs (cle),
--     taux_metiers (metier+niveau), quickbooks_connexion (ligne unique)
--     → chaque entreprise aura SES zones, SES numéros, SES taux, SA
--     connexion QuickBooks ;
--   • app_metadata.entreprise_id scellé côté serveur sur chaque compte ;
--   • politiques RLS « entreprise_id = jwt » sur les 22 tables + storage.
-- ============================================================
alter table bons_travail add column if not exists entreprise_id text not null default 'dgl';
create index if not exists idx_bons_travail_entreprise on bons_travail (entreprise_id);
alter table camions add column if not exists entreprise_id text not null default 'dgl';
create index if not exists idx_camions_entreprise on camions (entreprise_id);
alter table carnet_vehicules add column if not exists entreprise_id text not null default 'dgl';
create index if not exists idx_carnet_vehicules_entreprise on carnet_vehicules (entreprise_id);
alter table clients_app add column if not exists entreprise_id text not null default 'dgl';
create index if not exists idx_clients_app_entreprise on clients_app (entreprise_id);
alter table compteurs add column if not exists entreprise_id text not null default 'dgl';
create index if not exists idx_compteurs_entreprise on compteurs (entreprise_id);
alter table depots add column if not exists entreprise_id text not null default 'dgl';
create index if not exists idx_depots_entreprise on depots (entreprise_id);
alter table devis_app add column if not exists entreprise_id text not null default 'dgl';
create index if not exists idx_devis_app_entreprise on devis_app (entreprise_id);
alter table entretiens_vehicules add column if not exists entreprise_id text not null default 'dgl';
create index if not exists idx_entretiens_vehicules_entreprise on entretiens_vehicules (entreprise_id);
alter table fournisseurs add column if not exists entreprise_id text not null default 'dgl';
create index if not exists idx_fournisseurs_entreprise on fournisseurs (entreprise_id);
alter table inspections_vehicules add column if not exists entreprise_id text not null default 'dgl';
create index if not exists idx_inspections_vehicules_entreprise on inspections_vehicules (entreprise_id);
alter table journal_activite add column if not exists entreprise_id text not null default 'dgl';
create index if not exists idx_journal_activite_entreprise on journal_activite (entreprise_id);
alter table permissions_utilisateurs add column if not exists entreprise_id text not null default 'dgl';
create index if not exists idx_permissions_utilisateurs_entreprise on permissions_utilisateurs (entreprise_id);
alter table pieces_commandees add column if not exists entreprise_id text not null default 'dgl';
create index if not exists idx_pieces_commandees_entreprise on pieces_commandees (entreprise_id);
alter table prix_depots add column if not exists entreprise_id text not null default 'dgl';
create index if not exists idx_prix_depots_entreprise on prix_depots (entreprise_id);
alter table projets_app add column if not exists entreprise_id text not null default 'dgl';
create index if not exists idx_projets_app_entreprise on projets_app (entreprise_id);
alter table qb_attributions_manuelles add column if not exists entreprise_id text not null default 'dgl';
create index if not exists idx_qb_attributions_manuelles_entreprise on qb_attributions_manuelles (entreprise_id);
alter table quickbooks_connexion add column if not exists entreprise_id text not null default 'dgl';
create index if not exists idx_quickbooks_connexion_entreprise on quickbooks_connexion (entreprise_id);
alter table repertoire_employes add column if not exists entreprise_id text not null default 'dgl';
create index if not exists idx_repertoire_employes_entreprise on repertoire_employes (entreprise_id);
alter table taches_assignees add column if not exists entreprise_id text not null default 'dgl';
create index if not exists idx_taches_assignees_entreprise on taches_assignees (entreprise_id);
alter table taches_attente add column if not exists entreprise_id text not null default 'dgl';
create index if not exists idx_taches_attente_entreprise on taches_attente (entreprise_id);
alter table taux_metiers add column if not exists entreprise_id text not null default 'dgl';
create index if not exists idx_taux_metiers_entreprise on taux_metiers (entreprise_id);
alter table travaux_effectues add column if not exists entreprise_id text not null default 'dgl';
create index if not exists idx_travaux_effectues_entreprise on travaux_effectues (entreprise_id);

-- ============================================================
-- SNIPPET « 51 » — PLATEFORME (3e interface) + LOI 25
-- ------------------------------------------------------------
-- 1. La table `entreprises` devient le REGISTRE DES LOCATAIRES de la
--    plateforme : statut commercial (propriétaire / fondateur / essai /
--    payant / suspendu) + fin du gratuit (entente fondateurs : 1 an).
alter table entreprises add column if not exists statut_plateforme text not null default 'proprietaire';
alter table entreprises add column if not exists gratuit_jusqua date;
alter table entreprises add column if not exists suspendue boolean not null default false;

-- 2. VERROU D'ISOLATION — la création d'entreprises reste verrouillée
--    tant que le grand soir (RLS multi-locataires + test-sonde) n'est
--    pas passé. C'est la plateforme qui lit ce drapeau ; on ne le mettra
--    à vrai qu'après la preuve d'étanchéité.
create table if not exists plateforme_config (
  cle        text primary key,
  valeur     text,
  updated_at timestamptz not null default now()
);
insert into plateforme_config (cle, valeur) values ('isolation_activee', 'non')
  on conflict (cle) do nothing;

-- 3. REGISTRE DES INCIDENTS DE CONFIDENTIALITÉ — obligation Loi 25
--    (tenir un registre même sans incident ; notifier la Commission
--    d'accès à l'information et les personnes si préjudice sérieux).
create table if not exists incidents_confidentialite (
  id                 uuid primary key default gen_random_uuid(),
  date_incident      date not null,
  description        text not null,
  gravite            text not null default 'faible', -- faible | moyen | serieux
  mesures            text,
  personnes_touchees text,
  notifie_cai        boolean not null default false,
  notifie_personnes  boolean not null default false,
  cree_par           text,
  created_at         timestamptz not null default now()
);
alter table incidents_confidentialite enable row level security;
-- Réservé aux comptes PLATEFORME (sceau app_metadata, scellé serveur).
drop policy if exists "incidents_plateforme" on incidents_confidentialite;
create policy "incidents_plateforme" on incidents_confidentialite
  for all to authenticated
  using (coalesce((auth.jwt() -> 'app_metadata' ->> 'plateforme')::boolean, false))
  with check (coalesce((auth.jwt() -> 'app_metadata' ->> 'plateforme')::boolean, false));

-- 4. LE SCEAU DU PROPRIÉTAIRE DE PLATEFORME — app_metadata est la zone
--    que SEUL le serveur écrit : impossible à s'auto-attribuer.
update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"plateforme": true}'::jsonb
  where email = 'jeanfrancois@ventilationdgl.com';

-- SNIPPET « 52 » — droit acquis : payé au taux COMMERCIAL en tout temps.
-- Certains employés ont ce droit peu importe le secteur de la tâche ;
-- l'option se coche sur la fiche employé et FORCE le taux commercial au
-- moment où l'heure se fige (la feuille de temps suit la PAIE réelle).
alter table repertoire_employes add column if not exists toujours_commercial boolean not null default false;

-- ============================================================
-- SNIPPET « 53 » — MATÉRIEL (3 flux, décidés 2026-08-15)
-- ------------------------------------------------------------
-- 1. Commandes de matériel CAMION (technicien → bureau). Boucle courte :
--    envoyée → « ✓ Commande passée » (+ note facultative visible au
--    technicien). Pas d'étape « reçue » : le stock arrive dans son
--    camion, pas besoin de cérémonie. Frais général — aucun projet.
create table if not exists commandes_camion (
  id               uuid primary key default gen_random_uuid(),
  technicien_email text not null,
  technicien_nom   text,
  lignes           jsonb not null default '[]'::jsonb, -- [{article, quantite}]
  note_technicien  text,
  statut           text not null default 'envoyee', -- envoyee | commandee
  note_bureau      text,
  commandee_par    text,
  commandee_le     timestamptz,
  created_at       timestamptz not null default now(),
  entreprise_id    text not null default 'dgl'
);
alter table commandes_camion enable row level security;
drop policy if exists "commandes_camion_test" on commandes_camion;
create policy "commandes_camion_test" on commandes_camion
  for all to authenticated using (true) with check (true);
create index if not exists idx_commandes_camion_entreprise on commandes_camion (entreprise_id);

-- 2. ACHATS LIBRES : un bon de commande SANS tâche ni projet (ex. 4
--    rouleaux de tape). S'il vise un projet, il va plutôt dans
--    projets_app.bons_commande (le mécanisme de coûts existant).
create table if not exists achats_libres (
  id              uuid primary key default gen_random_uuid(),
  numero_bc       text,
  fournisseur_nom text,
  description     text,
  montant_ht      numeric not null default 0,
  statut          text not null default 'commande', -- commande | recu | annule
  cree_par        text,
  date_achat      date,
  created_at      timestamptz not null default now(),
  entreprise_id   text not null default 'dgl'
);
alter table achats_libres enable row level security;
drop policy if exists "achats_libres_test" on achats_libres;
create policy "achats_libres_test" on achats_libres
  for all to authenticated using (true) with check (true);
create index if not exists idx_achats_libres_entreprise on achats_libres (entreprise_id);

-- 3. MATÉRIEL DU STOCK attribué à un projet (déjà payé, sur la tablette)
--    — rangé SUR le projet comme ses bons de commande : entre dans les
--    coûts matériaux sans nouveau circuit.
alter table projets_app add column if not exists materiel_stock jsonb not null default '[]'::jsonb;

-- SNIPPET « 54 » — MODULES À LA CARTE par entreprise (plateforme).
-- null = tous les modules (DGL et historique) ; sinon la liste cochée
-- dans /plateforme. Appliqué dans les DEUX applications à la connexion.
alter table entreprises add column if not exists modules jsonb;

-- SNIPPET « 55 » — règles d'appels PAR ENTREPRISE + associations pro.
-- Chaque entreprise a SES règles (dépôt oui/non, délai, tranches) et
-- SES associations (CMMTQ / CETAF / CMEQ) sur les documents.
alter table entreprises add column if not exists associations jsonb;
alter table entreprises add column if not exists appels_depot_defaut boolean not null default true;
alter table entreprises add column if not exists delai_depot_heures numeric;
alter table entreprises add column if not exists tranche_facturation_min numeric;

-- SNIPPET « 56 » — facturation par siège (plateforme).
-- Prix MODIFIABLES par entreprise (hausses annuelles, ententes) ;
-- rabais fondateur 25 % à vie ; sièges inclus dans la base (4).
alter table entreprises add column if not exists prix_base numeric;
alter table entreprises add column if not exists sieges_inclus numeric not null default 4;
alter table entreprises add column if not exists prix_par_siege numeric;
alter table entreprises add column if not exists rabais_pourcent numeric not null default 0;

-- SNIPPET « 57 » — PROMOTIONS par entreprise (plateforme).
-- Rabais temporaire (X % pendant N mois) ancré sur la DATE DE CRÉATION
-- du compte client, après le 1er mois gratuit offert à tout nouveau
-- client ; ensuite retour au tarif régulier (les fondateurs gardent
-- leur rabais permanent — le meilleur des deux s'applique).
alter table entreprises add column if not exists promo_pourcent numeric not null default 0;
alter table entreprises add column if not exists promo_mois numeric not null default 0;

-- SNIPPET « 58 » — LÉGENDES DE PHOTOS (titre/détail sur une photo).
-- La légende suit la photo par son URL — écrite par le technicien sur
-- place ou par le bureau après coup, affichée dans la visionneuse.
create table if not exists photos_legendes (
  url           text primary key,
  legende       text,
  modifie_par   text,
  updated_at    timestamptz not null default now(),
  entreprise_id text not null default 'dgl'
);
alter table photos_legendes enable row level security;
drop policy if exists "photos_legendes_test" on photos_legendes;
create policy "photos_legendes_test" on photos_legendes
  for all to authenticated using (true) with check (true);
create index if not exists idx_photos_legendes_entreprise on photos_legendes (entreprise_id);

-- SNIPPET « 59 » — ACCEPTATION DE L'ENTENTE à la première connexion.
-- L'admin principal d'une entreprise cliente coche « j'ai lu et
-- j'accepte » à sa première entrée — qui, quand et quelle version sont
-- consignés sur la fiche de l'entreprise (preuve d'acceptation).
alter table entreprises add column if not exists entente_acceptee_le timestamptz;
alter table entreprises add column if not exists entente_acceptee_par text;
alter table entreprises add column if not exists entente_version text;

-- SNIPPET « 60 » — BON DE TRAVAIL PUBLIC : le client reçoit un lien
-- (valide 90 jours) vers un DESCRIPTIF de ses travaux — description,
-- photos avant/après avec légendes, signature. JAMAIS de prix ni
-- d'heures : ce n'est ni une soumission ni une facture (décision du
-- propriétaire, 2026-08-15). Même mécanique éprouvée que devis_public :
-- la table reste fermée aux anonymes, tout passe par une fonction qui
-- ne retourne QUE les champs choisis.
alter table bons_travail add column if not exists jeton_public text;
alter table bons_travail add column if not exists jeton_expire_le timestamptz;
alter table bons_travail add column if not exists envoye_client_le timestamptz;
create unique index if not exists idx_bons_jeton
  on bons_travail (jeton_public) where jeton_public is not null;

create or replace function bon_travail_public(p_jeton text)
returns table (
  entreprise_nom text,
  entreprise_adresse text,
  entreprise_telephone text,
  entreprise_courriel text,
  entreprise_rbq text,
  titre text,
  client_nom text,
  description text,
  date_travail date,
  adresse_travaux text,
  photos jsonb,
  legendes jsonb,
  signe_par_nom text,
  client_absent boolean,
  unites jsonb,
  expire boolean
)
language sql
security definer
set search_path = public
as $$
  select
    coalesce(e.nom_commercial, e.nom_legal, 'Ventilation DGL inc.'),
    e.adresse,
    e.telephone,
    e.courriel,
    e.numero_rbq,
    b.titre,
    b.client_nom,
    b.description,
    b.date_travail,
    b.adresse_travaux,
    coalesce(b.photos, '{}'::jsonb),
    -- Les légendes des photos du bon — et seulement celles-là.
    coalesce((
      select jsonb_object_agg(pl.url, pl.legende)
      from photos_legendes pl
      where pl.legende is not null and pl.legende <> ''
        and pl.url in (
          select jsonb_array_elements_text(coalesce(b.photos->'avant', '[]'::jsonb))
          union
          select jsonb_array_elements_text(coalesce(b.photos->'apres', '[]'::jsonb))
        )
    ), '{}'::jsonb),
    b.signe_par_nom,
    b.client_absent,
    coalesce(b.unites, '[]'::jsonb),
    (b.jeton_expire_le is not null and b.jeton_expire_le < now())
  from bons_travail b
  left join entreprises e on e.id = b.entreprise_id
  where b.jeton_public = p_jeton;
$$;

grant execute on function bon_travail_public(text) to anon, authenticated;

-- SNIPPET « 65 » — CAMION INDISPONIBLE + MÉTIERS MASQUÉS (2026-08-17).
-- 1) Un camion au garage se DÉCLARE (du/au + raison) : rappel à
--    l'agenda, tuile du tableau de bord en orange, et le camion se
--    grise dans le choix des techniciens à l'inspection du matin.
alter table camions add column if not exists indispo_debut date;
alter table camions add column if not exists indispo_fin date;
alter table camions add column if not exists indispo_raison text;
alter table camions add column if not exists indispo_note text;
-- 2) Métiers masqués de la grille des taux (chaque entreprise ne voit
--    que SES métiers) — les taux restent conservés, réaffichable.
alter table entreprises add column if not exists metiers_masques jsonb not null default '[]'::jsonb;

-- SNIPPET « 74 » — NOTIFICATIONS PUSH (2026-08-18).
-- Un abonnement push par employé (clé : son courriel de connexion) —
-- le téléphone du technicien reçoit « nouvelle tâche assignée » et
-- « matériel commandé » sans ouvrir l'application. AUCUNE policy :
-- la table n'est touchée que par la route serveur /api/notifications
-- (service role) — invisible depuis le navigateur.
create table if not exists push_abonnements (
  courriel   text primary key,
  abonnement jsonb not null,
  updated_at timestamptz not null default now()
);
alter table push_abonnements enable row level security;

-- SNIPPET « 71 » — TECHNICIEN FACTURABLE OU NON (2026-08-18).
-- Le PREMIER technicien d'une tâche est toujours facturable. À partir
-- du 2e, le bureau CHOISIT à l'assignation (obligé de choisir — jamais
-- de défaut silencieux) : un apprenti qu'on amène n'est pas facturé,
-- un vrai bras de plus l'est. Coûts et paie ne changent JAMAIS — seul
-- le calcul de facturation (temps supplémentaire des appels) en tient
-- compte.
alter table taches_assignees add column if not exists facturable boolean not null default true;

-- SNIPPET « 70 » — MÉMOIRE ARTICLE → FOURNISSEUR (2026-08-17).
-- La commande groupée du matériel camion se souvient chez QUI chaque
-- article a été commandé la dernière fois : la semaine suivante, tout
-- arrive pré-assigné — on vérifie d'un coup d'œil et on envoie.
create table if not exists articles_fournisseurs (
  article         text primary key,
  fournisseur_nom text not null,
  entreprise_id   text not null default 'dgl',
  updated_at      timestamptz not null default now()
);
alter table articles_fournisseurs enable row level security;
drop policy if exists "articles_fournisseurs_test" on articles_fournisseurs;
create policy "articles_fournisseurs_test" on articles_fournisseurs
  for all to authenticated using (true) with check (true);

-- SNIPPET « 69 » — ENVOI AUTOMATIQUE DES FACTURES : OPTION PAR
-- ENTREPRISE (2026-08-17). Activé : chaque facture créée (appels,
-- devis, contrats, dépôts, pièces) est ENVOYÉE immédiatement par
-- QuickBooks aux courriels choisis, avec preuve au registre.
-- Désactivé (défaut des nouvelles entreprises) : la facture est créée
-- dans QuickBooks SANS partir — bouton « Envoyer par QuickBooks » sur
-- chaque ligne. Réglable par l'Admin principal (Paramètres) ET par la
-- console plateforme. DGL : activé d'office (demande du propriétaire).
alter table entreprises add column if not exists envoi_auto_facture_qb boolean not null default false;
update entreprises set envoi_auto_facture_qb = true where id = 'dgl';

-- SNIPPET « 68 » — VERROU DE CONNEXION : 3 ÉCHECS = 15 MINUTES.
-- Compteur d'échecs par courriel, tenu CÔTÉ SERVEUR (route
-- /api/connexion — un compteur dans le navigateur ne vaudrait rien).
-- 3 échecs -> verrou 15 min + réinitialisation offerte à l'écran ;
-- réinitialisation réussie ou bonne connexion -> compteur effacé.
-- AUCUNE policy : la table n'est accessible qu'au service role (les
-- routes serveur) — invisible et intouchable depuis le navigateur.
create table if not exists connexion_echecs (
  courriel      text primary key,
  echecs        int not null default 0,
  dernier_echec timestamptz,
  verrou_jusqua timestamptz
);
alter table connexion_echecs enable row level security;

-- SNIPPET « 67 » — GRAND MÉNAGE SECURITY ADVISOR, TOUT-EN-UN (2026-08-17).
-- Couvre : les 2 erreurs (vues), les avertissements de sécurité
-- (search_path, fonctions appelables, clé de chiffrement, listage du
-- bucket) ET les avertissements de performance (règles RLS recalculées
-- par ligne, règles en double). À coller UNE fois, en entier.

-- ============================================================
-- A. LES 2 ERREURS : vues SECURITY DEFINER -> mode « invoker »
--    (elles respectent les règles de celui qui les consulte —
--    aucun impact : les employés connectés y ont toujours accès).
-- ============================================================
alter view annuaire_employes set (security_invoker = true);
alter view profils_utilisateurs_public set (security_invoker = true);

-- ============================================================
-- B. LA VRAIE TROUVAILLE : la clé de chiffrement et les fonctions
--    encrypt/decrypt étaient APPELABLES depuis le navigateur (même
--    sans connexion). Plus jamais.
-- ============================================================
revoke execute on function get_encryption_key() from public, anon, authenticated;
revoke execute on function encrypt_data(text) from public, anon, authenticated;
revoke execute on function decrypt_data(bytea) from public, anon, authenticated;
revoke execute on function fn_audit_trigger() from public, anon, authenticated;
revoke execute on function fn_set_updated_at() from public, anon, authenticated;

-- Les aides internes : réservées aux CONNECTÉS, plus d'accès anonyme.
revoke execute on function prochain_numero(text) from public, anon;
grant execute on function prochain_numero(text) to authenticated;
revoke execute on function fn_mon_email() from public, anon;
grant execute on function fn_mon_email() to authenticated;
revoke execute on function fn_mon_role() from public, anon;
grant execute on function fn_mon_role() to authenticated;
revoke execute on function fn_est_admin() from public, anon;
grant execute on function fn_est_admin() to authenticated;
revoke execute on function fn_est_admin_principal() from public, anon;
grant execute on function fn_est_admin_principal() to authenticated;
revoke execute on function fn_est_bureau() from public, anon;
grant execute on function fn_est_bureau() to authenticated;
revoke execute on function fn_sur_ma_tache(text) from public, anon;
grant execute on function fn_sur_ma_tache(text) to authenticated;

-- ============================================================
-- C. SEARCH_PATH épinglé sur TOUTES nos fonctions publiques
--    (« extensions » inclus : pgcrypto y vit).
-- ============================================================
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
  loop
    execute format('alter function %s set search_path = public, extensions', f.signature);
  end loop;
end $$;

-- ============================================================
-- D. STOCKAGE : le bucket public des photos n'a pas besoin d'une
--    policy de LECTURE (les adresses publiques marchent sans elle).
--    La retirer empêche un inconnu de LISTER tous les fichiers.
-- ============================================================
drop policy if exists "photos_travaux_lecture" on storage.objects;

-- ============================================================
-- E. PERFORMANCE 1 : les règles RLS qui rappellent auth.role() /
--    auth.uid() / auth.jwt() POUR CHAQUE LIGNE. Le correctif lit la
--    règle EN PLACE dans la base et la réécrit à l'identique, en
--    enveloppant l'appel dans (select …) — évalué UNE seule fois.
-- ============================================================
do $$
declare p record; nouv_qual text; nouv_check text; cmd_sql text;
begin
  for p in
    select * from pg_policies
    where schemaname = 'public'
      and (coalesce(qual, '') like '%auth.%' or coalesce(with_check, '') like '%auth.%')
      and (tablename, policyname) in (
        ('clients', 'Utilisateurs authentifies - acces complet'),
        ('taches_planifiees', 'Authentifies - acces complet'),
        ('travaux', 'Authentifies - acces complet'),
        ('travaux_photos', 'Authentifies - acces complet'),
        ('travaux_signatures', 'Authentifies - acces complet'),
        ('bons_travail_facturation', 'Authentifies - acces complet'),
        ('factures_progressives', 'Authentifies - acces complet'),
        ('transactions_quickbooks', 'Authentifies - acces complet'),
        ('profils_utilisateurs', 'profil_lecture'),
        ('profils_utilisateurs', 'profil_modification'),
        ('incidents_confidentialite', 'incidents_plateforme')
      )
  loop
    nouv_qual := replace(replace(replace(p.qual, 'auth.uid()', '(select auth.uid())'), 'auth.role()', '(select auth.role())'), 'auth.jwt()', '(select auth.jwt())');
    nouv_check := replace(replace(replace(p.with_check, 'auth.uid()', '(select auth.uid())'), 'auth.role()', '(select auth.role())'), 'auth.jwt()', '(select auth.jwt())');
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
    cmd_sql := format('create policy %I on public.%I for %s to %s', p.policyname, p.tablename, lower(p.cmd), array_to_string(p.roles, ', '));
    if nouv_qual is not null then cmd_sql := cmd_sql || format(' using (%s)', nouv_qual); end if;
    if nouv_check is not null then cmd_sql := cmd_sql || format(' with check (%s)', nouv_check); end if;
    execute cmd_sql;
  end loop;
end $$;

-- ============================================================
-- F. PERFORMANCE 2 : les règles « écriture » déclarées FOR ALL font
--    double emploi avec la règle de lecture sur les SELECT. Chacune
--    est relue EN PLACE et scindée en 3 règles précises (insert /
--    update / delete) — mêmes conditions, plus de doublon en lecture.
-- ============================================================
do $$
declare p record; q text; c text;
begin
  for p in
    select * from pg_policies
    where schemaname = 'public' and cmd = 'ALL' and policyname in (
      'bons_travail_ecriture', 'camions_ecriture_bureau', 'carnet_ecriture_bureau',
      'entreprises_ecriture_admin_principal', 'entretiens_ecriture_bureau', 'inspections_ecriture',
      'permissions_ecriture_admin_principal', 'prix_depots_ecriture_admin', 'repertoire_ecriture_admin',
      'taux_ecriture_admin', 'travaux_eff_ecriture'
    )
  loop
    q := coalesce(p.qual, 'true');
    c := coalesce(p.with_check, q);
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
    execute format('create policy %I on public.%I for insert to authenticated with check (%s)', p.policyname || '_ins', p.tablename, c);
    execute format('create policy %I on public.%I for update to authenticated using (%s) with check (%s)', p.policyname || '_upd', p.tablename, q, c);
    execute format('create policy %I on public.%I for delete to authenticated using (%s)', p.policyname || '_del', p.tablename, q);
  end loop;
end $$;

-- ============================================================
-- RESTENT VOLONTAIREMENT (à ignorer dans l'advisor) :
--   • devis_public / repondre_devis / bon_travail_public appelables par
--     anon : c'est LE mécanisme des pages publiques à jeton secret.
--   • Les policies « always true » (achats_libres, commandes_camion,
--     journal, photos_legendes…) : mode rodage assumé — resserrées au
--     grand soir multi-entreprises, avant la première entreprise cliente.
--   • « RLS enabled no policy » sur les tables héritées (bons_commande,
--     adresses_livraison, devis sans _app…) : verrouillées à double
--     tour, l'état le plus sûr — suppression définitive au grand soir.
-- ============================================================

-- SNIPPET « 61 » — ENVOI AUTO DU BON CLIENT + RETRAIT DE FACTURATION.
-- 1) Interrupteur par entreprise : à la fermeture de la tâche par le
--    technicien, le bon (descriptif public, sans prix) part TOUT SEUL
--    aux courriels cochés sur place. Débrayable dans Paramètres.
alter table entreprises add column if not exists envoi_auto_bon_client boolean not null default true;
-- 2) Retrait de facturation en deux temps (demande -> validation par un
--    Admin principal), avec raison prédéfinie et trace complète :
--    retrait_statut : 'demande' (en attente de validation),
--                     'reporte' (travaux en cours — reste dans la pile),
--                     'retire'  (garantie / client maison — sort de la pile).
--    Un bon retiré GARDE ses coûts (heures, camion) : il apparaît dans
--    l'analyse comme travail non facturable au lieu de s'évaporer.
alter table bons_travail add column if not exists retrait_statut text;
alter table bons_travail add column if not exists retrait_raison text;
alter table bons_travail add column if not exists retrait_note text;
alter table bons_travail add column if not exists retrait_demande_par text;
alter table bons_travail add column if not exists retrait_demande_le timestamptz;
alter table bons_travail add column if not exists retrait_valide_par text;
alter table bons_travail add column if not exists retrait_valide_le timestamptz;

-- SNIPPET « 62 » — SIGNATURE RECUEILLIE PAR UN COLLÈGUE (équipe de 2+).
-- Le dernier à fermer peut déclarer « mon collègue a déjà fait signer
-- le client » : sa propre signature n'est plus exigée, le bon part UNE
-- seule fois, et le bureau voit une mention neutre au lieu de l'alerte
-- « bon non signé ». La fonction publique est re-créée pour porter le
-- champ (le client voit « signature recueillie sur place »).
alter table bons_travail add column if not exists signe_par_collegue boolean not null default false;

-- Postgres ne peut pas CHANGER les colonnes de sortie d'une fonction
-- existante (erreur 42P13) : on la supprime puis on la recrée — même
-- seconde, aucun trou de service.
drop function if exists bon_travail_public(text);

create function bon_travail_public(p_jeton text)
returns table (
  entreprise_nom text,
  entreprise_adresse text,
  entreprise_telephone text,
  entreprise_courriel text,
  entreprise_rbq text,
  titre text,
  client_nom text,
  description text,
  date_travail date,
  adresse_travaux text,
  photos jsonb,
  legendes jsonb,
  signe_par_nom text,
  signe_par_collegue boolean,
  client_absent boolean,
  unites jsonb,
  expire boolean
)
language sql
security definer
set search_path = public
as $$
  select
    coalesce(e.nom_commercial, e.nom_legal, 'Ventilation DGL inc.'),
    e.adresse,
    e.telephone,
    e.courriel,
    e.numero_rbq,
    b.titre,
    b.client_nom,
    b.description,
    b.date_travail,
    b.adresse_travaux,
    coalesce(b.photos, '{}'::jsonb),
    coalesce((
      select jsonb_object_agg(pl.url, pl.legende)
      from photos_legendes pl
      where pl.legende is not null and pl.legende <> ''
        and pl.url in (
          select jsonb_array_elements_text(coalesce(b.photos->'avant', '[]'::jsonb))
          union
          select jsonb_array_elements_text(coalesce(b.photos->'apres', '[]'::jsonb))
        )
    ), '{}'::jsonb),
    b.signe_par_nom,
    coalesce(b.signe_par_collegue, false),
    b.client_absent,
    coalesce(b.unites, '[]'::jsonb),
    (b.jeton_expire_le is not null and b.jeton_expire_le < now())
  from bons_travail b
  left join entreprises e on e.id = b.entreprise_id
  where b.jeton_public = p_jeton;
$$;

grant execute on function bon_travail_public(text) to anon, authenticated;

-- SNIPPET « 64 » — LE BON PUBLIC PORTE L'ADRESSE DE FACTURATION ET LES
-- PHOTOS DE TOUTE L'ÉQUIPE (demande du propriétaire, 2026-08-17).
-- • Adresse de facturation : résolue À L'AFFICHAGE depuis la fiche
--   client (jamais figée sur le bon — toujours à jour, et jamais la
--   nôtre : celle du client ou rien, règle gelée).
-- • Photos : le bon ne portait que celles du DERNIER technicien à
--   fermer. La fonction fusionne maintenant les photos de TOUTES les
--   lignes d'heures de la tâche (chaque technicien enregistre les
--   siennes) — même celles d'un collègue qui ferme après l'envoi.
drop function if exists bon_travail_public(text);

create function bon_travail_public(p_jeton text)
returns table (
  entreprise_nom text,
  entreprise_adresse text,
  entreprise_telephone text,
  entreprise_courriel text,
  entreprise_rbq text,
  titre text,
  client_nom text,
  client_adresse_facturation text,
  description text,
  date_travail date,
  adresse_travaux text,
  photos jsonb,
  legendes jsonb,
  signe_par_nom text,
  signe_par_collegue boolean,
  client_absent boolean,
  unites jsonb,
  expire boolean
)
language sql
security definer
set search_path = public
as $$
  select
    coalesce(e.nom_commercial, e.nom_legal, 'Ventilation DGL inc.'),
    e.adresse,
    e.telephone,
    e.courriel,
    e.numero_rbq,
    b.titre,
    b.client_nom,
    c.adresse_facturation,
    b.description,
    b.date_travail,
    b.adresse_travaux,
    ph.photos,
    coalesce((
      select jsonb_object_agg(pl.url, pl.legende)
      from photos_legendes pl
      where pl.legende is not null and pl.legende <> ''
        and pl.url in (
          select jsonb_array_elements_text(coalesce(ph.photos->'avant', '[]'::jsonb))
          union
          select jsonb_array_elements_text(coalesce(ph.photos->'apres', '[]'::jsonb))
        )
    ), '{}'::jsonb),
    b.signe_par_nom,
    coalesce(b.signe_par_collegue, false),
    b.client_absent,
    coalesce(b.unites, '[]'::jsonb),
    (b.jeton_expire_le is not null and b.jeton_expire_le < now())
  from bons_travail b
  left join entreprises e on e.id = b.entreprise_id
  left join clients_app c
    on c.nom = b.client_nom and c.entreprise_id = b.entreprise_id
  cross join lateral (
    select jsonb_build_object(
      'avant', coalesce((
        select jsonb_agg(u) from (
          select distinct u from (
            select jsonb_array_elements_text(coalesce(b.photos->'avant', '[]'::jsonb)) as u
            union all
            select jsonb_array_elements_text(coalesce(t.photos->'avant', '[]'::jsonb))
              from travaux_effectues t
              where t.tache_id = b.tache_id or t.tache_id like b.tache_id || '::%'
          ) brut
        ) uniques
      ), '[]'::jsonb),
      'apres', coalesce((
        select jsonb_agg(u) from (
          select distinct u from (
            select jsonb_array_elements_text(coalesce(b.photos->'apres', '[]'::jsonb)) as u
            union all
            select jsonb_array_elements_text(coalesce(t.photos->'apres', '[]'::jsonb))
              from travaux_effectues t
              where t.tache_id = b.tache_id or t.tache_id like b.tache_id || '::%'
          ) brut
        ) uniques
      ), '[]'::jsonb)
    ) as photos
  ) ph
  where b.jeton_public = p_jeton;
$$;

grant execute on function bon_travail_public(text) to anon, authenticated;

-- ============================================================
-- SNIPPET « 72 » — CARNET DE CONTACTS PAR CLIENT (2026-08-17)
-- ------------------------------------------------------------
-- Les personnes à voir SUR PLACE (chargé de projet, concierge,
-- gérant…), réutilisables de chantier en chantier. Distinct des
-- courriels (facturation). [{ id, nom, role, telephone }]
-- ============================================================
alter table clients_app add column if not exists contacts jsonb not null default '[]'::jsonb;

-- ============================================================
-- SNIPPET « 73 » — RATTRAPAGE : colonne manquante de devis_app
-- ------------------------------------------------------------
-- Le snippet 48 (miroir estimate QuickBooks) n'avait jamais été passé
-- au complet en production : la colonne manquait et CHAQUE devis créé
-- depuis le 2026-08-15 échouait à l'enregistrement (diagnostic
-- empirique du 2026-08-17, erreur PGRST204 capturée dans l'app).
-- ============================================================
alter table devis_app add column if not exists qbo_estimate_id text;

-- ============================================================
-- 75 - SOUS-TRAITANTS À L'AGENDA (2026-08-19)
-- ------------------------------------------------------------
-- Répertoire des sous-traitants planifiables à l'agenda (section
-- « 🤝 Sous-traitants »). Un sous-traitant n'a PAS l'application :
-- pas de compte, pas de chronomètre — sa présence se confirme à la
-- main (statut Présent / Pas venu sur son bloc d'agenda, rangé dans
-- taches_assignees.donnees avec employe_email = 'st::<id>').
-- `client_id` : lien FACULTATIF vers la fiche client quand le
-- sous-traitant est AUSSI un client (une seule identité, deux rôles —
-- les coordonnées restent sur la fiche client, jamais dupliquées).
-- ============================================================
create table if not exists sous_traitants_app (
  id text primary key,
  nom text not null,
  specialite text,
  telephone text,
  courriel text,
  note text,
  client_id text,
  actif boolean not null default true,
  entreprise_id text not null default 'dgl',
  cree_le timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table sous_traitants_app enable row level security;

drop policy if exists "sous_traitants_lecture_test" on sous_traitants_app;
drop policy if exists "sous_traitants_ecriture_test" on sous_traitants_app;
create policy "sous_traitants_lecture_test" on sous_traitants_app
  for select to authenticated using (true);
create policy "sous_traitants_ecriture_test" on sous_traitants_app
  for all to authenticated using (true) with check (true);

-- ============================================================
-- 76 - TRAVAUX NON TERMINÉS + CE QUI RESTE À FAIRE (2026-08-22)
-- ------------------------------------------------------------
-- Demande du propriétaire. Différent de « pièce à commander » : là,
-- c'est une pièce qui manque ; ici, c'est le TRAVAIL qui n'est pas
-- fini — manque de temps, accès impossible, imprévu de chantier.
--
-- Sans ces deux colonnes, le bureau recevait un bon comme un autre et
-- facturait un travail inachevé ; et ce qui restait à faire vivait
-- dans la tête du technicien jusqu'au lendemain matin.
--
-- Les heures faites se comptent et se facturent normalement — seule la
-- FERMETURE du dossier attend le retour sur place. La carte de
-- facturation affiche l'avertissement en orange, avec le texte du
-- technicien repris mot pour mot.
--
-- L'application sait vivre sans ces colonnes (elle réessaie sans
-- elles) : un bon de travail n'est jamais perdu parce qu'un snippet
-- n'a pas encore été passé.
-- ============================================================
alter table bons_travail add column if not exists travaux_non_termines boolean not null default false;
alter table bons_travail add column if not exists reste_a_faire text;

-- ============================================================
-- 77 - MATÉRIEL AUX COÛTS PAR TÂCHE (2026-08-25)
-- ------------------------------------------------------------
-- Demande du propriétaire — fermer la boucle des coûts matériel :
-- « chaque dollar de matériel compte UNE fois ».
--
-- Deux chemins, deux ajouts :
--   • ACHAT DIRECT pour une job : l'achat libre peut se rattacher à
--     une TÂCHE (tache_id + titre + client recopiés pour l'affichage),
--     avec un MONTANT ATTRIBUÉ ajustable à la baisse — on profite
--     d'une commande pour ajouter du stock, seule la part de la job
--     compte dans son coût, le reste demeure un achat général.
--   • CONSOMMATION D'ENTREPÔT : items de catalogue au COÛT STANDARD
--     posés sur le bon de travail (materiel_stock jsonb :
--     [{ nom, quantite, coutant }]) — le forfait murale, la prise de
--     l'électricien, les consommables. Le rouleau de 164 pieds, lui,
--     reste un achat général : son coût se récupère job après job via
--     ces items standards.
--
-- L'application sait vivre sans ces colonnes (réessai sans elles).
-- ============================================================
alter table achats_libres add column if not exists tache_id text;
alter table achats_libres add column if not exists tache_titre text;
alter table achats_libres add column if not exists client_nom text;
alter table achats_libres add column if not exists montant_attribue numeric;
alter table bons_travail add column if not exists materiel_stock jsonb;

-- ============================================================
-- 78 - DÉPENSES QUICKBOOKS RATTACHABLES À UNE TÂCHE OU À UN CLIENT
--      (2026-08-26)
-- ------------------------------------------------------------
-- Jusqu'ici une dépense QuickBooks n'avait qu'UNE destination : un
-- projet. Le produit acheté pour une job SANS projet (une tâche, un
-- client) n'entrait donc dans aucun coût — il restait orphelin, et le
-- coût réel de la job était faux en silence.
--
-- `cible_type` + `cible_id` remplacent `projet_id` :
--   'projet' | 'tache' | 'client'
-- La colonne `projet_id` est CONSERVÉE (jamais supprimée) pour que les
-- attributions déjà enregistrées continuent de fonctionner — elles sont
-- relues comme cible_type = 'projet'.
-- ============================================================
alter table qb_attributions_manuelles add column if not exists cible_type text;
alter table qb_attributions_manuelles add column if not exists cible_id text;

-- Reprise du passé : les attributions existantes deviennent des cibles
-- de type « projet ». Idempotent — relancer ce snippet ne casse rien.
update qb_attributions_manuelles
   set cible_type = 'projet',
       cible_id = projet_id
 where cible_type is null
   and projet_id is not null;

-- ============================================================
-- 79 - BON DE COMMANDE RATTACHABLE À UN CLIENT + MODIFIABLE
--      (2026-08-26)
-- ------------------------------------------------------------
-- La liste des bons de commande libres était en LECTURE SEULE : pas de
-- correction possible (fournisseur, montant, description), pas de
-- suppression, et un achat ne pouvait viser qu'une tâche — pas un
-- client directement. `client_id` permet le rattachement direct : le
-- coût remonte dans « Coût réel & marge — par client » même sans tâche
-- ni projet, et la dépense QuickBooks portant ce numéro de BC suit.
-- (`client_nom` existait déjà — étiquette recopiée de la tâche.)
-- ============================================================
alter table achats_libres add column if not exists client_id text;

-- ============================================================
-- 80 - NETTOYAGE DES PIÈCES EN DOUBLE + VERROU ANTI-DOUBLON
--      (2026-08-27)
-- ------------------------------------------------------------
-- Bogue vécu : la création automatique des demandes de pièces tournait
-- AVANT le chargement de la liste — chaque rechargement de page voyait
-- « aucune pièce » et recréait toutes les demandes (pile de doublons
-- « Jhgjby » constatée par le propriétaire). Le code est corrigé (double
-- garde), ce snippet efface les doublons EXISTANTS et pose le verrou
-- définitif en base.
-- ============================================================

-- 1. UNE pièce par tâche d'origine : la PLUS ANCIENNE survit (c'est
--    elle que le bureau a pu commencer à traiter). Les pièces créées à
--    la main (sans tâche d'origine) ne sont jamais touchées.
delete from pieces_commandees p
 using pieces_commandees d
 where p.tache_origine_id is not null
   and d.tache_origine_id = p.tache_origine_id
   and (d.created_at, d.id::text) < (p.created_at, p.id::text);

-- 2. Les tâches de RETOUR orphelines créées par les doublons : on
--    n'efface une tâche « retour-... » que si (a) plus aucune pièce ne
--    la référence ET (b) une autre tâche retour du MÊME groupe existe
--    encore — une tâche détachée volontairement (« garder sans pièce »)
--    reste donc intouchée.
delete from taches_attente t
 where t.id like 'retour-%'
   and not exists (select 1 from pieces_commandees pc where pc.tache_retour_id = t.id)
   and exists (
     select 1 from taches_attente t2
      where t2.id like 'retour-%'
        and t2.id <> t.id
        and regexp_replace(t2.id, '-[0-9]+$', '') = regexp_replace(t.id, '-[0-9]+$', '')
   );

-- 3. LE VERROU : plus jamais deux pièces pour la même tâche d'origine.
create unique index if not exists idx_pieces_tache_origine_unique
  on pieces_commandees (tache_origine_id)
  where tache_origine_id is not null;

-- ============================================================
-- 81 - Date-plancher QuickBooks (« ne rien lire avant le... »)
-- ============================================================
-- L'historique d'AVANT Fluxya (des annees de factures) reste dans
-- QuickBooks : sans coûts en face dans l'application (pas d'heures
-- pointees, pas de BC), l'importer fabriquerait des marges fausses et
-- remplirait la liste « a rattacher » de centaines de cartes inutiles.
-- Cette colonne porte la date choisie dans Parametres → Connexions ;
-- vide = comportement d'origine (les 12 derniers mois).

alter table entreprises add column if not exists qb_lecture_depuis date;

-- ============================================================
-- 82 - RETOURS SUR LE LOGICIEL (communication en 2 etages)
-- ============================================================
-- Le circuit valide par le proprietaire (2026-09-02) : le TECHNICIEN
-- signale un bug ou propose une idee → l'ADMIN de SON entreprise trie
-- (regle a l'interne, refuse, ou TRANSMET a Fluxya) → la console
-- plateforme ne recoit que les retours transmis. Statuts :
--   nouveau → regle-interne | refuse-interne | transmis
--   transmis → en-cours → regle | refuse   (cote Fluxya)

create table if not exists retours_logiciel (
  id uuid primary key default gen_random_uuid(),
  entreprise_id text not null default 'dgl',
  type text not null default 'bug' check (type in ('bug','idee')),
  message text not null,
  photo_url text,
  contexte jsonb,
  auteur_email text,
  auteur_nom text,
  statut text not null default 'nouveau'
    check (statut in ('nouveau','regle-interne','refuse-interne','transmis','en-cours','regle','refuse')),
  reponse_admin text,
  transmis_le timestamptz,
  transmis_par text,
  commentaire_transmission text,
  reponse_fluxya text,
  traite_par text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table retours_logiciel enable row level security;
drop policy if exists "retours_logiciel_test" on retours_logiciel;
create policy "retours_logiciel_test" on retours_logiciel
  for all to authenticated using (true) with check (true);

alter publication supabase_realtime add table retours_logiciel;

-- ============================================================
-- 83 - NIVEAUX DE L'EQUIPE FLUXYA (console plateforme)
-- ============================================================
-- Hierarchie validee par le proprietaire (2026-09-02) : jusqu'a 3
-- « cle-principale » (lui + associes eventuels — tout pouvoir, seuls a
-- gerer l'equipe), puis admin-regulier (abonnements + retours +
-- incidents), gestionnaire (retours + incidents, abonnements en
-- lecture), technicien (retours seulement). Le niveau vit dans
-- app_metadata (scelle serveur, comme le sceau du snippet 51) ; un
-- sceau SANS niveau est traite comme cle-principale (compatibilite).

update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
    || '{"plateforme": true, "plateforme_role": "cle-principale"}'::jsonb
  where email = 'jeanfrancois@ventilationdgl.com';

-- ============================================================
-- 84 - GRAND RESET DE LANCEMENT (a passer LE JOUR DE LA BASCULE
--      QuickBooks, JAMAIS avant — decisions du proprietaire 2026-09-04)
-- ============================================================
-- Les vraies heures/taches/facturation des dernieres semaines vivent
-- sur l'ancienne plateforme : tout ce qui est dans Fluxya est du RODAGE.
-- On repart a zero PROPRE, en gardant la configuration.
--
-- ⚠️ AVANT DE PASSER CE SNIPPET : declencher une SAUVEGARDE complete
-- (bouton admin ou attendre le cron du lundi) — c'est le parachute.
--
-- ON GARDE (ne touche pas) : entreprises (Parametres + date-plancher),
-- taux_metiers (grille CCQ), prix_depots (zones), repertoire_employes
-- (fiches employes), permissions_utilisateurs (acces), compteurs
-- (numeros sequentiels — continuite avec l'historique), push_abonnements
-- (notifications deja activees sur les telephones), plateforme_config,
-- incidents_confidentialite, comptes auth.users, console plateforme.
--
-- ON EFFACE (decisions une a une du proprietaire) :

-- Operationnel — clients, jobs, heures, facturation (rodage)
delete from taches_assignees;
delete from taches_attente;
delete from travaux_effectues;
delete from bons_travail;
delete from devis_app;
delete from depots;
delete from pieces_commandees;
delete from achats_libres;
delete from projets_app;
delete from clients_app;
delete from qb_attributions_manuelles;
delete from journal_activite;
delete from retours_logiciel;
delete from commandes_camion;
delete from photos_legendes;

-- Camions & inspections — « on recommence » (les camions se recreent a
-- la premiere inspection ; le correctif « premier contact » fait que le
-- kilometrage d'entree devient le point de depart de l'entretien)
delete from entretiens_vehicules;
delete from carnet_vehicules;
delete from inspections_vehicules;
delete from camions;

-- Fournisseurs & sous-traitants — « on recommence »
delete from articles_fournisseurs;
delete from fournisseurs;
delete from sous_traitants_app;

-- Catalogue — sera RETELECHARGE du vrai QuickBooks apres la bascule
-- (bouton « Mettre a jour depuis QuickBooks », onglet Tarifs)
delete from catalogue_items;

-- Liens Sandbox residuels sur ce qui RESTE : aucun (les fiches et le
-- catalogue qui portaient qb_item_id / quickbooks_customer_id viennent
-- d'etre effaces). La connexion QuickBooks elle-meme sera remplacee par
-- la reconnexion OAuth du jour J.

-- Photos et signatures de chantier du rodage : Supabase INTERDIT de
-- les effacer par SQL (protection storage.protect_delete). Etape
-- MANUELLE apres ce snippet : tableau de bord Supabase → Storage →
-- bucket « photos-travaux » → tout selectionner → Delete ; idem pour
-- le bucket « signatures ». (Le bucket « sauvegardes » ne se touche
-- JAMAIS — c est le parachute.)

-- ============================================================
-- 85 - LE GRAND SOIR : CLOISONS RLS MULTI-ENTREPRISES
--      (2026-09-04 — a passer LE SOIR, hors des heures de pointage :
--      les sessions deja ouvertes prennent jusqu'a ~1 h pour recevoir
--      leur etiquette dans le jeton ; se deconnecter/reconnecter regle
--      tout de suite.)
-- ============================================================
-- AVANT : toutes les policies etaient « authenticated → tout » (mode
-- test assume). APRES : chaque ligne porte son entreprise_id, chaque
-- compte porte son etiquette (app_metadata, scellee serveur), et une
-- policy par table n'ouvre QUE les lignes de SA propre entreprise.
-- La console plateforme (sceau) garde ses acces cibles. Les tables
-- heritees inutilisees sont verrouillees completement.

-- ---- 0. LA COLONNE entreprise_id SUR LES 29 TABLES (correctif
--         2026-09-05 : la vraie base avait des tables creees par des
--         versions plus anciennes des snippets, SANS la colonne —
--         p. ex. push_abonnements. Idempotent : if not exists.) ----
do $$
declare t text;
begin
  foreach t in array array[
    'clients_app','projets_app','devis_app','taches_attente','taches_assignees',
    'travaux_effectues','bons_travail','depots','pieces_commandees','achats_libres',
    'qb_attributions_manuelles','journal_activite','retours_logiciel','commandes_camion',
    'photos_legendes','articles_fournisseurs','fournisseurs','sous_traitants_app',
    'camions','inspections_vehicules','entretiens_vehicules','carnet_vehicules',
    'catalogue_items','taux_metiers','prix_depots','repertoire_employes',
    'permissions_utilisateurs','compteurs','push_abonnements'
  ]
  loop
    if exists (select 1 from pg_tables where schemaname = 'public' and tablename = t) then
      execute format('alter table public.%I add column if not exists entreprise_id text not null default ''dgl''', t);
    end if;
  end loop;
end $$;

-- ---- 1. Etiqueter TOUS les comptes existants (tous DGL aujourd'hui) ----
update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"entreprise_id": "dgl"}'::jsonb;

-- ---- 2. Les deux fonctions de garde (lisent le JETON, done infalsifiable) ----
create or replace function public.entreprise_du_jeton() returns text
language sql stable as
$fn$ select nullif((auth.jwt() -> 'app_metadata') ->> 'entreprise_id', '') $fn$;

create or replace function public.est_plateforme() returns boolean
language sql stable as
$fn$ select coalesce(((auth.jwt() -> 'app_metadata') ->> 'plateforme')::boolean, false) $fn$;

-- ---- 3. Trigger d'etiquetage a l'insertion ----
-- Un utilisateur connecte ecrit TOUJOURS dans SA propre entreprise —
-- meme si l'application envoyait une autre valeur, le jeton l'emporte.
-- Les routes serveur (cle service, jeton absent) gardent la valeur
-- qu'elles posent explicitement, sinon 'dgl'.
create or replace function public.poser_entreprise_id() returns trigger
language plpgsql as
$fn$
begin
  new.entreprise_id := coalesce(public.entreprise_du_jeton(), new.entreprise_id, 'dgl');
  return new;
end
$fn$;

-- ---- 4. CLOISONS : une policy d'isolation par table d'entreprise ----
do $$
declare
  t text;
  p record;
begin
  foreach t in array array[
    'clients_app','projets_app','devis_app','taches_attente','taches_assignees',
    'travaux_effectues','bons_travail','depots','pieces_commandees','achats_libres',
    'qb_attributions_manuelles','journal_activite','retours_logiciel','commandes_camion',
    'photos_legendes','articles_fournisseurs','fournisseurs','sous_traitants_app',
    'camions','inspections_vehicules','entretiens_vehicules','carnet_vehicules',
    'catalogue_items','taux_metiers','prix_depots','repertoire_employes',
    'permissions_utilisateurs','compteurs','push_abonnements'
  ]
  loop
    -- table absente de la vraie base (derive de versions) : on saute
    if not exists (select 1 from pg_tables where schemaname = 'public' and tablename = t) then
      continue;
    end if;
    execute format('alter table public.%I enable row level security', t);
    -- retirer TOUTES les anciennes policies de la table (mode test)
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;
    -- la cloison : chacun chez soi, lecture ET ecriture
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (entreprise_id = public.entreprise_du_jeton())
         with check (entreprise_id = public.entreprise_du_jeton())',
      'iso_' || t, t
    );
    -- l'etiquette se pose toute seule a l'insertion
    execute format('drop trigger if exists trg_entreprise_%I on public.%I', t, t);
    execute format(
      'create trigger trg_entreprise_%I before insert on public.%I
         for each row execute function public.poser_entreprise_id()',
      t, t
    );
  end loop;
end $$;

-- ---- 5. EXCEPTION : retours_logiciel — la plateforme lit/traite AUSSI ----
drop policy if exists "iso_retours_logiciel" on retours_logiciel;
create policy "iso_retours_logiciel" on retours_logiciel
  for all to authenticated
  using (entreprise_id = public.entreprise_du_jeton() or public.est_plateforme())
  with check (entreprise_id = public.entreprise_du_jeton() or public.est_plateforme());

-- ---- 6. EXCEPTION : entreprises — sa propre fiche, ou la plateforme ----
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'entreprises'
  loop
    execute format('drop policy %I on public.entreprises', p.policyname);
  end loop;
end $$;
alter table entreprises enable row level security;
create policy "entreprises_sa_fiche" on entreprises
  for select to authenticated
  using (id = public.entreprise_du_jeton() or public.est_plateforme());
create policy "entreprises_maj_sa_fiche" on entreprises
  for update to authenticated
  using (id = public.entreprise_du_jeton() or public.est_plateforme())
  with check (id = public.entreprise_du_jeton() or public.est_plateforme());
create policy "entreprises_creation_plateforme" on entreprises
  for insert to authenticated
  with check (public.est_plateforme());

-- ---- 7. plateforme_config : lecture plateforme seulement (le verrou
--         d'isolation se LIT de la console ; il ne s'ecrit qu'en base) ----
alter table plateforme_config enable row level security;
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'plateforme_config'
  loop
    execute format('drop policy %I on public.plateforme_config', p.policyname);
  end loop;
end $$;
create policy "config_lecture_plateforme" on plateforme_config
  for select to authenticated using (public.est_plateforme());

-- ---- 8. VERROUILLAGE des tables service et heritees ----
-- RLS active + AUCUNE policy = porte fermee pour tout navigateur.
-- (Les routes serveur passent par la cle service, qui n'est pas soumise
-- aux policies.) Tables heritees : code mort confirme, on condamne.
do $$
declare
  t text;
  p record;
begin
  foreach t in array array['quickbooks_connexion','connexion_echecs','travaux','travaux_photos','travaux_signatures','signatures','bons_travail_facturation']
  loop
    if exists (select 1 from pg_tables where schemaname = 'public' and tablename = t) then
      execute format('alter table public.%I enable row level security', t);
      for p in select policyname from pg_policies where schemaname = 'public' and tablename = t
      loop
        execute format('drop policy %I on public.%I', p.policyname, t);
      end loop;
    end if;
  end loop;
end $$;

-- (incidents_confidentialite garde sa policy plateforme existante.)

-- ============================================================
-- 86 - COMPTE-SONDE D'ETANCHEITE (grand soir)
-- ============================================================
-- Etiquette le compte-espion cree dans Authentication → Add user
-- (sonde@etancheite.test) comme une entreprise ETRANGERE : la sonde
-- doit tout se faire refuser. Voir sonde-etancheite.mjs a la racine
-- du projet pour l'execution du test.

update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
    || '{"entreprise_id": "sonde-entreprise-test", "plateforme": false}'::jsonb
  where email = 'sonde@etancheite.test';

-- ============================================================
-- 87 - DESACTIVATION D'EMPLOYES + OPTION TRANSPORT QUOTIDIEN
--      (2026-09-05 — deux GO du proprietaire)
-- ============================================================
-- (1) DESACTIVER un employe : la fiche RESTE (historique RH, heures
-- passees intactes dans les paies et les couts), mais il disparait de
-- l'agenda, des paies courantes et des selecteurs ; son compte est
-- banni cote serveur (route /api/utilisateurs/acces). Raison + date +
-- note consignees. Reactivable en un clic.
-- (2) TRANSPORT DEBUT/FIN DE JOURNEE optionnel : par ENTREPRISE
-- (certaines compagnies vont direct au chantier — pas de transport
-- paye) avec DEROGATION par employe (suit l'entreprise / toujours /
-- jamais). Le transport journalier CCQ entre deux clients, lui, reste
-- toujours paye (c'est du temps de travail).

alter table repertoire_employes add column if not exists statut text not null default 'actif';
alter table repertoire_employes add column if not exists depart_raison text;
alter table repertoire_employes add column if not exists depart_date date;
alter table repertoire_employes add column if not exists depart_note text;
alter table repertoire_employes add column if not exists transport_quotidien text not null default 'defaut';

alter table entreprises add column if not exists transport_quotidien_paye boolean not null default true;

-- L'ANNUAIRE (vue lisible par les techniciens — jamais les salaires)
-- refait : (a) seulement les employes ACTIFS ; (b) CLOISONNE par
-- entreprise (la vue s'execute avec les droits de son proprietaire et
-- contournait les cloisons du snippet 85 — auth.jwt() lit quand meme le
-- jeton de l'APPELANT, donc le filtre tient) ; (c) expose l'option
-- transport pour que le telephone sache quoi fabriquer.
drop view if exists annuaire_employes;
create view annuaire_employes as
  select id, nom, courriel, nom_utilisateur, transport_quotidien
  from repertoire_employes
  where statut = 'actif'
    and entreprise_id = public.entreprise_du_jeton();
grant select on annuaire_employes to authenticated;

-- ============================================================
-- 88 - COLMATAGE COMPLET APRES SONDE (grand soir, version garantie)
--      (2026-09-05)
-- ============================================================
-- La sonde a revele que le snippet 85 n'avait ete applique QU'EN
-- PARTIE sur la vraie base (entreprise_du_jeton existait, mais pas
-- poser_entreprise_id ; 27 tables etanches, 2 fuites). Plutot que de
-- deviner ce qui manque, CE snippet refait TOUT le grand soir de
-- facon autosuffisante et idempotente : fonctions, etiquettes des
-- comptes, cloisons + triggers sur les 29 tables, exceptions,
-- verrouillages — puis AFFICHE l'etat complet de la base en resultat.
-- Il peut etre relance autant de fois que necessaire.

-- ---- 0. La colonne entreprise_id partout (idempotent) ----
do $$
declare t text;
begin
  foreach t in array array[
    'clients_app','projets_app','devis_app','taches_attente','taches_assignees',
    'travaux_effectues','bons_travail','depots','pieces_commandees','achats_libres',
    'qb_attributions_manuelles','journal_activite','retours_logiciel','commandes_camion',
    'photos_legendes','articles_fournisseurs','fournisseurs','sous_traitants_app',
    'camions','inspections_vehicules','entretiens_vehicules','carnet_vehicules',
    'catalogue_items','taux_metiers','prix_depots','repertoire_employes',
    'permissions_utilisateurs','compteurs','push_abonnements'
  ]
  loop
    if exists (select 1 from pg_tables where schemaname = 'public' and tablename = t) then
      execute format('alter table public.%I add column if not exists entreprise_id text not null default ''dgl''', t);
    end if;
  end loop;
end $$;

-- ---- 1. Les 3 fonctions de garde ----
create or replace function public.entreprise_du_jeton() returns text
language sql stable as
$fn$ select nullif((auth.jwt() -> 'app_metadata') ->> 'entreprise_id', '') $fn$;

create or replace function public.est_plateforme() returns boolean
language sql stable as
$fn$ select coalesce(((auth.jwt() -> 'app_metadata') ->> 'plateforme')::boolean, false) $fn$;

create or replace function public.poser_entreprise_id() returns trigger
language plpgsql as
$fn$
begin
  new.entreprise_id := coalesce(public.entreprise_du_jeton(), new.entreprise_id, 'dgl');
  return new;
end
$fn$;

-- ---- 2. Etiquettes des comptes : tout le monde DGL... ----
update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"entreprise_id": "dgl"}'::jsonb
  where email is distinct from 'sonde@etancheite.test';

-- ...sauf la sonde, etiquetee entreprise ETRANGERE ----
update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
    || '{"entreprise_id": "sonde-entreprise-test", "plateforme": false}'::jsonb
  where email = 'sonde@etancheite.test';

-- ---- 3. CLOISONS : policy d'isolation + trigger sur les 29 tables ----
do $$
declare
  t text;
  p record;
begin
  foreach t in array array[
    'clients_app','projets_app','devis_app','taches_attente','taches_assignees',
    'travaux_effectues','bons_travail','depots','pieces_commandees','achats_libres',
    'qb_attributions_manuelles','journal_activite','retours_logiciel','commandes_camion',
    'photos_legendes','articles_fournisseurs','fournisseurs','sous_traitants_app',
    'camions','inspections_vehicules','entretiens_vehicules','carnet_vehicules',
    'catalogue_items','taux_metiers','prix_depots','repertoire_employes',
    'permissions_utilisateurs','compteurs','push_abonnements'
  ]
  loop
    if not exists (select 1 from pg_tables where schemaname = 'public' and tablename = t) then
      continue;
    end if;
    execute format('alter table public.%I enable row level security', t);
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (entreprise_id = public.entreprise_du_jeton())
         with check (entreprise_id = public.entreprise_du_jeton())',
      'iso_' || t, t
    );
    execute format('drop trigger if exists trg_entreprise_%I on public.%I', t, t);
    execute format(
      'create trigger trg_entreprise_%I before insert on public.%I
         for each row execute function public.poser_entreprise_id()',
      t, t
    );
  end loop;
end $$;

-- ---- 4. EXCEPTION : retours_logiciel — la plateforme lit/traite AUSSI ----
drop policy if exists "iso_retours_logiciel" on retours_logiciel;
create policy "iso_retours_logiciel" on retours_logiciel
  for all to authenticated
  using (entreprise_id = public.entreprise_du_jeton() or public.est_plateforme())
  with check (entreprise_id = public.entreprise_du_jeton() or public.est_plateforme());

-- ---- 5. EXCEPTION : entreprises — sa propre fiche, ou la plateforme ----
alter table entreprises enable row level security;
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'entreprises'
  loop
    execute format('drop policy %I on public.entreprises', p.policyname);
  end loop;
end $$;
create policy "entreprises_sa_fiche" on entreprises
  for select to authenticated
  using (id = public.entreprise_du_jeton() or public.est_plateforme());
create policy "entreprises_maj_sa_fiche" on entreprises
  for update to authenticated
  using (id = public.entreprise_du_jeton() or public.est_plateforme())
  with check (id = public.entreprise_du_jeton() or public.est_plateforme());
create policy "entreprises_creation_plateforme" on entreprises
  for insert to authenticated
  with check (public.est_plateforme());

-- ---- 6. plateforme_config : lecture plateforme seulement ----
alter table plateforme_config enable row level security;
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'plateforme_config'
  loop
    execute format('drop policy %I on public.plateforme_config', p.policyname);
  end loop;
end $$;
create policy "config_lecture_plateforme" on plateforme_config
  for select to authenticated using (public.est_plateforme());

-- ---- 7. VERROUILLAGE des tables service et heritees ----
do $$
declare
  t text;
  p record;
begin
  foreach t in array array['quickbooks_connexion','connexion_echecs','travaux','travaux_photos','travaux_signatures','signatures','bons_travail_facturation']
  loop
    if exists (select 1 from pg_tables where schemaname = 'public' and tablename = t) then
      execute format('alter table public.%I enable row level security', t);
      for p in select policyname from pg_policies where schemaname = 'public' and tablename = t
      loop
        execute format('drop policy %I on public.%I', p.policyname, t);
      end loop;
    end if;
  end loop;
end $$;

-- ---- 8. ETAT COMPLET DE LA BASE (s'affiche dans Results) ----
select c.relname as table_nom,
       c.relrowsecurity as rls_active,
       coalesce(string_agg(p.policyname, ' | ' order by p.policyname), '(aucune)') as policies
from pg_class c
join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
left join pg_policies p on p.schemaname = 'public' and p.tablename = c.relname
where c.relkind = 'r'
group by c.relname, c.relrowsecurity
order by c.relname;

-- ============================================================
-- 89 - LEVER LE VERROU DE CREATION D'ENTREPRISES (apres sonde verte)
--      (2026-09-05 — sonde 33/33 tables etanches + usurpation re-etiquetee)
-- ============================================================
update plateforme_config set valeur = 'oui', updated_at = now() where cle = 'isolation_activee';
select cle, valeur from plateforme_config where cle = 'isolation_activee';

-- ============================================================
-- 90 - RAPATRIEMENT DU COMPTE PROPRIETAIRE + VERIF DES ETIQUETTES
--      (2026-09-06 — apres le test a blanc Ventilation Miroir : la
--      route inviter re-etiquetait un compte existant vers
--      l'entreprise de l'inviteur ; route colmatee, ce snippet remet
--      le compte du proprietaire chez DGL et nettoie la fiche
--      parasite, puis AFFICHE l'etiquette de TOUS les comptes.) ----
update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"entreprise_id": "dgl"}'::jsonb
  where email = 'jeanfrancois@ventilationdgl.com';
delete from repertoire_employes
  where lower(coalesce(courriel, '')) = 'jeanfrancois@ventilationdgl.com'
    and entreprise_id <> 'dgl';
select email,
       raw_app_meta_data->>'entreprise_id' as entreprise,
       coalesce(raw_app_meta_data->>'plateforme', '') as sceau_console
from auth.users
order by 2, 1;

-- ============================================================
-- 91 - LOGO PAR ENTREPRISE + ASSOCIATIONS NON PRE-COCHEES
--      (2026-09-06 — retours du test a blanc : le logo etait le
--      fichier DGL code en dur, et la CMMTQ arrivait cochee pour
--      un nouveau client.) ----
alter table entreprises add column if not exists logo_donnees text;
-- Les entreprises deja creees (test Miroir) : aucune association
-- d'office — chacune coche les siennes dans ses Parametres.
update entreprises
  set membre_cmmtq = false, associations = '[]'::jsonb
  where id <> 'dgl';
select id, nom_legal, membre_cmmtq, associations, (logo_donnees is not null) as logo_present from entreprises order by id;

-- ============================================================
-- 92 - IDENTITE DU CLIENT SUR LES PAGES PUBLIQUES devis/[jeton] et bon/[jeton]
--      (2026-09-06 — suite du test a blanc : ces pages chargeaient
--      l'identite en anonyme, les cloisons RLS la bloquaient et la page
--      retombait sur l'identite DGL. L'identite voyage desormais AVEC
--      la charge utile des fonctions publiques — nom, telephone,
--      courriel, taux de taxes et LOGO de la bonne entreprise.)
-- ============================================================

-- Le logo (pose par le snippet 91 — filet si jamais il n'est pas passe)
alter table entreprises add column if not exists logo_donnees text;

-- ---- 1. devis_public : + identite de l'entreprise emettrice ----
-- (drop obligatoire : la liste des colonnes retournees change)
drop function if exists devis_public(text);
create function devis_public(p_jeton text)
returns table (
  numero text, client_nom text, date_emission date,
  lignes jsonb, total_vendant numeric,
  statut text, reponse_client text, repondu_le timestamptz, expire boolean,
  entreprise_id text,
  entreprise_nom text,
  entreprise_telephone text,
  entreprise_courriel text,
  entreprise_taux_tps numeric,
  entreprise_taux_tvq numeric,
  entreprise_logo text
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
    (d.jeton_expire_le is not null and d.jeton_expire_le < now()),
    d.entreprise_id,
    coalesce(e.nom_commercial, e.nom_legal),
    e.telephone,
    e.courriel,
    e.taux_tps,
    e.taux_tvq,
    e.logo_donnees
  from devis_app d
  left join entreprises e on e.id = d.entreprise_id
  where d.jeton_public = p_jeton and d.version_active;
$$;
revoke all on function devis_public(text) from public;
grant execute on function devis_public(text) to anon, authenticated;

-- ---- 2. bon_travail_public : + entreprise_id et LOGO ----
drop function if exists bon_travail_public(text);
create function bon_travail_public(p_jeton text)
returns table (
  entreprise_nom text,
  entreprise_adresse text,
  entreprise_telephone text,
  entreprise_courriel text,
  entreprise_rbq text,
  titre text,
  client_nom text,
  client_adresse_facturation text,
  description text,
  date_travail date,
  adresse_travaux text,
  photos jsonb,
  legendes jsonb,
  signe_par_nom text,
  signe_par_collegue boolean,
  client_absent boolean,
  unites jsonb,
  expire boolean,
  entreprise_id text,
  entreprise_logo text
)
language sql
security definer
set search_path = public
as $$
  select
    coalesce(e.nom_commercial, e.nom_legal, 'Ventilation DGL inc.'),
    e.adresse,
    e.telephone,
    e.courriel,
    e.numero_rbq,
    b.titre,
    b.client_nom,
    c.adresse_facturation,
    b.description,
    b.date_travail,
    b.adresse_travaux,
    ph.photos,
    coalesce((
      select jsonb_object_agg(pl.url, pl.legende)
      from photos_legendes pl
      where pl.legende is not null and pl.legende <> ''
        and pl.url in (
          select jsonb_array_elements_text(coalesce(ph.photos->'avant', '[]'::jsonb))
          union
          select jsonb_array_elements_text(coalesce(ph.photos->'apres', '[]'::jsonb))
        )
    ), '{}'::jsonb),
    b.signe_par_nom,
    coalesce(b.signe_par_collegue, false),
    b.client_absent,
    coalesce(b.unites, '[]'::jsonb),
    (b.jeton_expire_le is not null and b.jeton_expire_le < now()),
    b.entreprise_id,
    e.logo_donnees
  from bons_travail b
  left join entreprises e on e.id = b.entreprise_id
  left join clients_app c
    on c.nom = b.client_nom and c.entreprise_id = b.entreprise_id
  cross join lateral (
    select jsonb_build_object(
      'avant', coalesce((
        select jsonb_agg(u) from (
          select distinct u from (
            select jsonb_array_elements_text(coalesce(b.photos->'avant', '[]'::jsonb)) as u
            union all
            select jsonb_array_elements_text(coalesce(t.photos->'avant', '[]'::jsonb))
              from travaux_effectues t
              where t.tache_id = b.tache_id or t.tache_id like b.tache_id || '::%'
          ) brut
        ) uniques
      ), '[]'::jsonb),
      'apres', coalesce((
        select jsonb_agg(u) from (
          select distinct u from (
            select jsonb_array_elements_text(coalesce(b.photos->'apres', '[]'::jsonb)) as u
            union all
            select jsonb_array_elements_text(coalesce(t.photos->'apres', '[]'::jsonb))
              from travaux_effectues t
              where t.tache_id = b.tache_id or t.tache_id like b.tache_id || '::%'
          ) brut
        ) uniques
      ), '[]'::jsonb)
    ) as photos
  ) ph
  where b.jeton_public = p_jeton;
$$;
grant execute on function bon_travail_public(text) to anon, authenticated;

-- ============================================================
-- 93 - MENAGE DES METIERS DES ENTREPRISES DE TEST (2026-09-06)
--      La grille de Ventilation Miroir affichait encore TOUS les
--      metiers CCQ : sa table taux_metiers portait les lignes (a 0 $)
--      sauvegardees a l'epoque de la grille pre-remplie. On efface les
--      taux des entreprises AUTRES que DGL — leur grille repart vide
--      et elles choisissent LEURS metiers par les pastilles de Tarifs.
--      (DGL intouchee : sa grille reelle reste.)
delete from taux_metiers where entreprise_id <> 'dgl';
select entreprise_id, count(*) as lignes_restantes from taux_metiers group by 1;

-- ============================================================
-- 94 - RAPATRIEMENT DU JOURNAL DGL CONTAMINE (Loi 25, 2026-09-06)
--      PAS une fuite des cloisons : pendant la fenetre du compte vole
--      (faille inviter, colmatee au commit f75a8e4), le compte du
--      proprietaire etait etiquete ventilation-miroir COTE SERVEUR
--      alors que son navigateur travaillait encore chez DGL (vieux
--      jeton ~1 h) — ses ecritures de journal (et celles passees par
--      sa session) ont ete estampillees MIROIR. On les rapatrie chez
--      DGL par leur contenu, puis on AFFICHE la repartition.
-- (correctif : la vraie table n'a PAS de colonne par_nom — l'auteur est
--  inscrit DANS le texte, « — par X » ; tout se filtre donc sur texte)
update journal_activite set entreprise_id = 'dgl'
 where entreprise_id <> 'dgl'
   and (texte like '%ventilationdgl.com%'
     or texte like '%Dominic Gariepy%'
     or texte like '%Sophie Roy%'
     or texte like '%Marc Gagnon%'
     or texte like '%Descente des clients QuickBooks%');
select entreprise_id, count(*) as entrees from journal_activite group by 1 order by 1;

-- ============================================================
-- 95 - MENAGE DES CLIENTS DE DEMONSTRATION PERSISTES (2026-09-06)
--      « Toitures Lavallee inc. » et « Residence Tremblay » (nos
--      donnees de test d'origine, QBO-1001/1002) vivaient encore
--      comme VRAIES lignes dans clients_app de DGL — persistees par
--      les vieux flux de demo. Les sources de demo dans le code sont
--      toutes purgees (commit du meme jour) ; ce snippet efface les
--      lignes deja en base, ainsi que la tache-semence de demo.
delete from clients_app
 where nom in ('Toitures Lavallée inc.', 'Résidence Tremblay');
-- (la clause par numero QuickBooks est GARDEE par un test d'existence de
--  colonne — la vraie base derive parfois de schema.sql, lecon apprise)
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'clients_app'
               and column_name = 'quickbooks_customer_id') then
    delete from clients_app where quickbooks_customer_id in ('QBO-1001', 'QBO-1002');
  end if;
end $$;
delete from taches_attente where id = 'tache-seed1';
select entreprise_id, count(*) as clients_restants from clients_app group by 1 order by 1;

-- ============================================================
-- 96 - FICHES D'EMPLOYES CONTAMINEES (le « doublon » de l'agenda)
--      (2026-09-06) Ventilation Miroir affichait DEUX fois le
--      proprietaire : sa vraie fiche (jflatour1985@gmail.com) ET une
--      fiche DGL (jeanfrancois@ventilationdgl.com) tombee dans sa
--      bulle pendant la fenetre du compte vole (faille inviter, deja
--      colmatee). Le snippet 90 ne l'avait pas attrapee : il filtrait
--      sur la colonne courriel, or la fiche auto-creee porte parfois
--      un courriel vide — son ID, lui, contient toujours l'adresse.
--      Ici on ratisse les DEUX (courriel ET id), pour toute entreprise
--      autre que DGL. La meme personne ne peut plus etre doublee dans
--      l'agenda ni les paies (garde-fou pose cote application aussi).
-- ============================================================
delete from repertoire_employes
 where entreprise_id <> 'dgl'
   and (lower(coalesce(courriel, '')) like '%@ventilationdgl.com'
     or lower(coalesce(id, ''))       like '%@ventilationdgl.com');

-- Meme menage cote autorisations (aucun effet sur DGL).
delete from permissions_utilisateurs
 where entreprise_id <> 'dgl'
   and lower(coalesce(email, '')) like '%@ventilationdgl.com';

-- Ce qui RESTE, entreprise par entreprise (verification a l'oeil) :
select entreprise_id, nom, courriel, nom_utilisateur, coalesce(statut, 'actif') as statut
  from repertoire_employes
 order by entreprise_id, nom;

-- ============================================================
-- 97 - RBQ ET ASSOCIATIONS SUR LES PAGES PUBLIQUES (2026-09-08)
-- ------------------------------------------------------------
-- Retour du test a blanc Miroir : le numero RBQ et « membre de la
-- CETAF » etaient remplis dans les Parametres AVANT la creation du
-- devis, mais la page publique ne les montrait pas. Normal : la page
-- est anonyme, l'identite voyage AVEC la charge utile (snippet 92) —
-- et le RBQ/associations n'etaient pas dans le bagage du DEVIS (le bon
-- de travail avait deja le RBQ, mais pas les associations, et la page
-- ne l'affichait pas non plus).
-- Ici : les deux fonctions publiques retournent aussi numero_rbq et
-- associations. L'affichage suit cote pages.
-- ============================================================

-- ---- 1. devis_public : + RBQ + associations ----
drop function if exists devis_public(text);
create function devis_public(p_jeton text)
returns table (
  numero text, client_nom text, date_emission date,
  lignes jsonb, total_vendant numeric,
  statut text, reponse_client text, repondu_le timestamptz, expire boolean,
  entreprise_id text,
  entreprise_nom text,
  entreprise_telephone text,
  entreprise_courriel text,
  entreprise_taux_tps numeric,
  entreprise_taux_tvq numeric,
  entreprise_logo text,
  entreprise_rbq text,
  entreprise_associations jsonb
)
language sql security definer set search_path = public as $$
  select
    d.numero, d.client_nom, d.date_emission,
    -- Les lignes sont RECONSTRUITES sans prix_coutant : le coutant ne
    -- peut pas fuir, meme par erreur de programmation cote page.
    (select coalesce(jsonb_agg(jsonb_build_object(
        'uid', l->>'uid', 'nom', l->>'nom', 'description', l->>'description',
        'quantite', l->'quantite', 'prix_vendant', l->'prix_vendant')), '[]'::jsonb)
     from jsonb_array_elements(d.lignes) l),
    d.total_vendant, d.statut, d.reponse_client, d.repondu_le,
    (d.jeton_expire_le is not null and d.jeton_expire_le < now()),
    d.entreprise_id,
    coalesce(e.nom_commercial, e.nom_legal),
    e.telephone,
    e.courriel,
    e.taux_tps,
    e.taux_tvq,
    e.logo_donnees,
    e.numero_rbq,
    coalesce(e.associations, case when e.membre_cmmtq then '["cmmtq"]'::jsonb else '[]'::jsonb end)
  from devis_app d
  left join entreprises e on e.id = d.entreprise_id
  where d.jeton_public = p_jeton and d.version_active;
$$;
revoke all on function devis_public(text) from public;
grant execute on function devis_public(text) to anon, authenticated;

-- ---- 2. bon_travail_public : + associations (le RBQ y etait deja) ----
-- La fonction est recreee A L'IDENTIQUE du snippet 92, avec UNE colonne
-- de plus a la fin.
drop function if exists bon_travail_public(text);
create function bon_travail_public(p_jeton text)
returns table (
  entreprise_nom text,
  entreprise_adresse text,
  entreprise_telephone text,
  entreprise_courriel text,
  entreprise_rbq text,
  titre text,
  client_nom text,
  client_adresse_facturation text,
  description text,
  date_travail date,
  adresse_travaux text,
  photos jsonb,
  legendes jsonb,
  signe_par_nom text,
  signe_par_collegue boolean,
  client_absent boolean,
  unites jsonb,
  expire boolean,
  entreprise_id text,
  entreprise_logo text,
  entreprise_associations jsonb
)
language sql
security definer
set search_path = public
as $$
  select
    coalesce(e.nom_commercial, e.nom_legal, 'Ventilation DGL inc.'),
    e.adresse,
    e.telephone,
    e.courriel,
    e.numero_rbq,
    b.titre,
    b.client_nom,
    c.adresse_facturation,
    b.description,
    b.date_travail,
    b.adresse_travaux,
    ph.photos,
    coalesce((
      select jsonb_object_agg(pl.url, pl.legende)
      from photos_legendes pl
      where pl.legende is not null and pl.legende <> ''
        and pl.url in (
          select jsonb_array_elements_text(coalesce(ph.photos->'avant', '[]'::jsonb))
          union
          select jsonb_array_elements_text(coalesce(ph.photos->'apres', '[]'::jsonb))
        )
    ), '{}'::jsonb),
    b.signe_par_nom,
    coalesce(b.signe_par_collegue, false),
    b.client_absent,
    coalesce(b.unites, '[]'::jsonb),
    (b.jeton_expire_le is not null and b.jeton_expire_le < now()),
    b.entreprise_id,
    e.logo_donnees,
    coalesce(e.associations, case when e.membre_cmmtq then '["cmmtq"]'::jsonb else '[]'::jsonb end)
  from bons_travail b
  left join entreprises e on e.id = b.entreprise_id
  left join clients_app c
    on c.nom = b.client_nom and c.entreprise_id = b.entreprise_id
  cross join lateral (
    select jsonb_build_object(
      'avant', coalesce((
        select jsonb_agg(u) from (
          select distinct u from (
            select jsonb_array_elements_text(coalesce(b.photos->'avant', '[]'::jsonb)) as u
            union all
            select jsonb_array_elements_text(coalesce(t.photos->'avant', '[]'::jsonb))
              from travaux_effectues t
              where t.tache_id = b.tache_id or t.tache_id like b.tache_id || '::%'
          ) brut
        ) uniques
      ), '[]'::jsonb),
      'apres', coalesce((
        select jsonb_agg(u) from (
          select distinct u from (
            select jsonb_array_elements_text(coalesce(b.photos->'apres', '[]'::jsonb)) as u
            union all
            select jsonb_array_elements_text(coalesce(t.photos->'apres', '[]'::jsonb))
              from travaux_effectues t
              where t.tache_id = b.tache_id or t.tache_id like b.tache_id || '::%'
          ) brut
        ) uniques
      ), '[]'::jsonb)
    ) as photos
  ) ph
  where b.jeton_public = p_jeton;
$$;
grant execute on function bon_travail_public(text) to anon, authenticated;

-- ============================================================
-- 98 - UN QUICKBOOKS PAR ENTREPRISE (2026-09-08)
-- ------------------------------------------------------------
-- GO du proprietaire : « assure-toi que chaque client a son QuickBooks
-- separe et independant de tous ». Avant : UNE connexion pour toute la
-- plateforme (unique par environnement), verrouillee « DGL seulement ».
-- Maintenant : une ligne PAR entreprise — son realm, ses jetons, son
-- environnement (sandbox/production peuvent coexister). Les routes
-- serveur ne servent que la connexion de l'entreprise du demandeur.
-- ============================================================
alter table quickbooks_connexion add column if not exists entreprise_id text not null default 'dgl';
-- L'ancienne unicite « une ligne par environnement » saute — elle
-- interdirait a deux entreprises d'etre en sandbox en meme temps…
alter table quickbooks_connexion drop constraint if exists quickbooks_connexion_environnement_key;
alter table quickbooks_connexion drop constraint if exists quickbooks_connexion_pkey cascade;
-- …remplacee par : UNE connexion par entreprise (nouvelle cle primaire).
alter table quickbooks_connexion add primary key (entreprise_id);
-- Verification : la connexion existante doit etre etiquetee dgl.
select entreprise_id, environnement, realm_id, updated_at from quickbooks_connexion;

-- ============================================================
-- 99 - IDENTITE COMPLETE SUR LE DEVIS PUBLIC (2026-09-09)
-- ------------------------------------------------------------
-- Retour du proprietaire : « ce ne sont pas toutes les informations de
-- l'entreprise qui apparaissent dans le devis ». L'en-tete montrait
-- telephone, courriel, RBQ et associations — mais pas l'ADRESSE, pas le
-- SITE WEB, et surtout pas les NUMEROS TPS/TVQ, obligatoires sur un
-- document qui charge les taxes (Revenu Quebec).
-- Les deux fonctions publiques ajoutent ces colonnes A LA FIN (les
-- pages qui ne les lisent pas encore continuent de marcher).
-- ============================================================

-- ---- 1. devis_public : + adresse, site web, numeros TPS/TVQ ----
drop function if exists devis_public(text);
create function devis_public(p_jeton text)
returns table (
  numero text, client_nom text, date_emission date,
  lignes jsonb, total_vendant numeric,
  statut text, reponse_client text, repondu_le timestamptz, expire boolean,
  entreprise_id text,
  entreprise_nom text,
  entreprise_telephone text,
  entreprise_courriel text,
  entreprise_taux_tps numeric,
  entreprise_taux_tvq numeric,
  entreprise_logo text,
  entreprise_rbq text,
  entreprise_associations jsonb,
  entreprise_adresse text,
  entreprise_site_web text,
  entreprise_numero_tps text,
  entreprise_numero_tvq text
)
language sql security definer set search_path = public as $$
  select
    d.numero, d.client_nom, d.date_emission,
    -- Les lignes sont RECONSTRUITES sans prix_coutant : le coutant ne
    -- peut pas fuir, meme par erreur de programmation cote page.
    (select coalesce(jsonb_agg(jsonb_build_object(
        'uid', l->>'uid', 'nom', l->>'nom', 'description', l->>'description',
        'quantite', l->'quantite', 'prix_vendant', l->'prix_vendant')), '[]'::jsonb)
     from jsonb_array_elements(d.lignes) l),
    d.total_vendant, d.statut, d.reponse_client, d.repondu_le,
    (d.jeton_expire_le is not null and d.jeton_expire_le < now()),
    d.entreprise_id,
    coalesce(e.nom_commercial, e.nom_legal),
    e.telephone,
    e.courriel,
    e.taux_tps,
    e.taux_tvq,
    e.logo_donnees,
    e.numero_rbq,
    coalesce(e.associations, case when e.membre_cmmtq then '["cmmtq"]'::jsonb else '[]'::jsonb end),
    e.adresse,
    e.site_web,
    e.numero_tps,
    e.numero_tvq
  from devis_app d
  left join entreprises e on e.id = d.entreprise_id
  where d.jeton_public = p_jeton and d.version_active;
$$;
revoke all on function devis_public(text) from public;
grant execute on function devis_public(text) to anon, authenticated;

-- ---- 2. bon_travail_public : + site web (adresse et RBQ y sont deja) ----
-- Recreee a l'identique du snippet 97, avec UNE colonne de plus a la fin.
drop function if exists bon_travail_public(text);
create function bon_travail_public(p_jeton text)
returns table (
  entreprise_nom text,
  entreprise_adresse text,
  entreprise_telephone text,
  entreprise_courriel text,
  entreprise_rbq text,
  titre text,
  client_nom text,
  client_adresse_facturation text,
  description text,
  date_travail date,
  adresse_travaux text,
  photos jsonb,
  legendes jsonb,
  signe_par_nom text,
  signe_par_collegue boolean,
  client_absent boolean,
  unites jsonb,
  expire boolean,
  entreprise_id text,
  entreprise_logo text,
  entreprise_associations jsonb,
  entreprise_site_web text
)
language sql
security definer
set search_path = public
as $$
  select
    coalesce(e.nom_commercial, e.nom_legal, 'Ventilation DGL inc.'),
    e.adresse,
    e.telephone,
    e.courriel,
    e.numero_rbq,
    b.titre,
    b.client_nom,
    c.adresse_facturation,
    b.description,
    b.date_travail,
    b.adresse_travaux,
    ph.photos,
    coalesce((
      select jsonb_object_agg(pl.url, pl.legende)
      from photos_legendes pl
      where pl.legende is not null and pl.legende <> ''
        and pl.url in (
          select jsonb_array_elements_text(coalesce(ph.photos->'avant', '[]'::jsonb))
          union
          select jsonb_array_elements_text(coalesce(ph.photos->'apres', '[]'::jsonb))
        )
    ), '{}'::jsonb),
    b.signe_par_nom,
    coalesce(b.signe_par_collegue, false),
    b.client_absent,
    coalesce(b.unites, '[]'::jsonb),
    (b.jeton_expire_le is not null and b.jeton_expire_le < now()),
    b.entreprise_id,
    e.logo_donnees,
    coalesce(e.associations, case when e.membre_cmmtq then '["cmmtq"]'::jsonb else '[]'::jsonb end),
    e.site_web
  from bons_travail b
  left join entreprises e on e.id = b.entreprise_id
  left join clients_app c
    on c.nom = b.client_nom and c.entreprise_id = b.entreprise_id
  cross join lateral (
    select jsonb_build_object(
      'avant', coalesce((
        select jsonb_agg(u) from (
          select distinct u from (
            select jsonb_array_elements_text(coalesce(b.photos->'avant', '[]'::jsonb)) as u
            union all
            select jsonb_array_elements_text(coalesce(t.photos->'avant', '[]'::jsonb))
              from travaux_effectues t
              where t.tache_id = b.tache_id or t.tache_id like b.tache_id || '::%'
          ) brut
        ) uniques
      ), '[]'::jsonb),
      'apres', coalesce((
        select jsonb_agg(u) from (
          select distinct u from (
            select jsonb_array_elements_text(coalesce(b.photos->'apres', '[]'::jsonb)) as u
            union all
            select jsonb_array_elements_text(coalesce(t.photos->'apres', '[]'::jsonb))
              from travaux_effectues t
              where t.tache_id = b.tache_id or t.tache_id like b.tache_id || '::%'
          ) brut
        ) uniques
      ), '[]'::jsonb)
    ) as photos
  ) ph
  where b.jeton_public = p_jeton;
$$;
grant execute on function bon_travail_public(text) to anon, authenticated;

-- ============================================================
-- 100 - LE NEQ SUR LES DOCUMENTS (2026-08-28)
-- ------------------------------------------------------------
-- Retour du proprietaire : « tu as fait une ligne NEQ, elle n'apparait
-- pas sur les documents ». Le champ existait dans les Parametres et se
-- sauvegardait — il n'etait affiche NULLE PART. L'ecran et les PDF sont
-- corriges cote application ; les deux pages publiques ont besoin que
-- le numero VOYAGE avec la charge utile (elles sont anonymes : les
-- cloisons RLS leur interdisent de lire la fiche entreprise).
-- Meme methode que les snippets 97 et 99 : la colonne s'ajoute A LA FIN.
-- ============================================================

-- ---- 1. devis_public : + NEQ ----
drop function if exists devis_public(text);
create function devis_public(p_jeton text)
returns table (
  numero text, client_nom text, date_emission date,
  lignes jsonb, total_vendant numeric,
  statut text, reponse_client text, repondu_le timestamptz, expire boolean,
  entreprise_id text,
  entreprise_nom text,
  entreprise_telephone text,
  entreprise_courriel text,
  entreprise_taux_tps numeric,
  entreprise_taux_tvq numeric,
  entreprise_logo text,
  entreprise_rbq text,
  entreprise_associations jsonb,
  entreprise_adresse text,
  entreprise_site_web text,
  entreprise_numero_tps text,
  entreprise_numero_tvq text,
  entreprise_neq text
)
language sql security definer set search_path = public as $$
  select
    d.numero, d.client_nom, d.date_emission,
    -- Les lignes sont RECONSTRUITES sans prix_coutant : le coutant ne
    -- peut pas fuir, meme par erreur de programmation cote page.
    (select coalesce(jsonb_agg(jsonb_build_object(
        'uid', l->>'uid', 'nom', l->>'nom', 'description', l->>'description',
        'quantite', l->'quantite', 'prix_vendant', l->'prix_vendant')), '[]'::jsonb)
     from jsonb_array_elements(d.lignes) l),
    d.total_vendant, d.statut, d.reponse_client, d.repondu_le,
    (d.jeton_expire_le is not null and d.jeton_expire_le < now()),
    d.entreprise_id,
    coalesce(e.nom_commercial, e.nom_legal),
    e.telephone,
    e.courriel,
    e.taux_tps,
    e.taux_tvq,
    e.logo_donnees,
    e.numero_rbq,
    coalesce(e.associations, case when e.membre_cmmtq then '["cmmtq"]'::jsonb else '[]'::jsonb end),
    e.adresse,
    e.site_web,
    e.numero_tps,
    e.numero_tvq,
    e.numero_neq
  from devis_app d
  left join entreprises e on e.id = d.entreprise_id
  where d.jeton_public = p_jeton and d.version_active;
$$;
revoke all on function devis_public(text) from public;
grant execute on function devis_public(text) to anon, authenticated;

-- ---- 2. bon_travail_public : + NEQ, + numeros de taxes ----
-- (le bon de travail ne charge pas de taxes, mais l'identite doit etre
--  la MEME partout : un client compare ses documents entre eux)
drop function if exists bon_travail_public(text);
create function bon_travail_public(p_jeton text)
returns table (
  entreprise_nom text,
  entreprise_adresse text,
  entreprise_telephone text,
  entreprise_courriel text,
  entreprise_rbq text,
  titre text,
  client_nom text,
  client_adresse_facturation text,
  description text,
  date_travail date,
  adresse_travaux text,
  photos jsonb,
  legendes jsonb,
  signe_par_nom text,
  signe_par_collegue boolean,
  client_absent boolean,
  unites jsonb,
  expire boolean,
  entreprise_id text,
  entreprise_logo text,
  entreprise_associations jsonb,
  entreprise_site_web text,
  entreprise_neq text,
  entreprise_numero_tps text,
  entreprise_numero_tvq text
)
language sql
security definer
set search_path = public
as $$
  select
    coalesce(e.nom_commercial, e.nom_legal, 'Ventilation DGL inc.'),
    e.adresse,
    e.telephone,
    e.courriel,
    e.numero_rbq,
    b.titre,
    b.client_nom,
    c.adresse_facturation,
    b.description,
    b.date_travail,
    b.adresse_travaux,
    ph.photos,
    coalesce((
      select jsonb_object_agg(pl.url, pl.legende)
      from photos_legendes pl
      where pl.legende is not null and pl.legende <> ''
        and pl.url in (
          select jsonb_array_elements_text(coalesce(ph.photos->'avant', '[]'::jsonb))
          union
          select jsonb_array_elements_text(coalesce(ph.photos->'apres', '[]'::jsonb))
        )
    ), '{}'::jsonb),
    b.signe_par_nom,
    coalesce(b.signe_par_collegue, false),
    b.client_absent,
    coalesce(b.unites, '[]'::jsonb),
    (b.jeton_expire_le is not null and b.jeton_expire_le < now()),
    b.entreprise_id,
    e.logo_donnees,
    coalesce(e.associations, case when e.membre_cmmtq then '["cmmtq"]'::jsonb else '[]'::jsonb end),
    e.site_web,
    e.numero_neq,
    e.numero_tps,
    e.numero_tvq
  from bons_travail b
  left join entreprises e on e.id = b.entreprise_id
  left join clients_app c
    on c.nom = b.client_nom and c.entreprise_id = b.entreprise_id
  cross join lateral (
    select jsonb_build_object(
      'avant', coalesce((
        select jsonb_agg(u) from (
          select distinct u from (
            select jsonb_array_elements_text(coalesce(b.photos->'avant', '[]'::jsonb)) as u
            union all
            select jsonb_array_elements_text(coalesce(t.photos->'avant', '[]'::jsonb))
              from travaux_effectues t
              where t.tache_id = b.tache_id or t.tache_id like b.tache_id || '::%'
          ) brut
        ) uniques
      ), '[]'::jsonb),
      'apres', coalesce((
        select jsonb_agg(u) from (
          select distinct u from (
            select jsonb_array_elements_text(coalesce(b.photos->'apres', '[]'::jsonb)) as u
            union all
            select jsonb_array_elements_text(coalesce(t.photos->'apres', '[]'::jsonb))
              from travaux_effectues t
              where t.tache_id = b.tache_id or t.tache_id like b.tache_id || '::%'
          ) brut
        ) uniques
      ), '[]'::jsonb)
    ) as photos
  ) ph
  where b.jeton_public = p_jeton;
$$;
grant execute on function bon_travail_public(text) to anon, authenticated;

-- ============================================================
-- 101 - REPRISE DE CHANTIER (2026-08-28)
-- ------------------------------------------------------------
-- « J'ajoute Fluxya a mon infrastructure — est-ce qu'on pourrait
-- ajouter des factures deja produites ou des heures dans le projet
-- pour comptabiliser ? » Un chantier commence AVANT Fluxya affichait
-- une rentabilite fausse : tout le travail et tout l'argent du debut
-- manquaient. La colonne garde ce qui a ete fait avant, sans jamais
-- le meler aux heures pointees ni aux factures QuickBooks :
--   { heures:   [{id, qui, heures, taux, date, note}],
--     factures: [{id, montant, date, note}] }
-- Additive : les projets existants gardent {} et rien ne change.
-- ============================================================
alter table projets_app add column if not exists reprise jsonb not null default '{}'::jsonb;
select count(*) as projets, count(*) filter (where reprise <> '{}'::jsonb) as avec_reprise from projets_app;

-- ============================================================
-- 102 - PROJET DE DEMONSTRATION RESIDUEL (2026-08-28)
-- ------------------------------------------------------------
-- « Refection toiture — Entrepot & Chantier Nord » est un residu de nos
-- toutes premieres donnees de test (scenario de couvreur), persiste
-- dans projets_app de DGL. Il ne vient PAS du code : les constantes de
-- demo sont vides depuis le 2026-09-05, donc aucun nouvel utilisateur
-- ne peut le voir apparaitre — il fallait seulement effacer la ligne.
-- Les taches qui pointaient dessus sont detachees (jamais supprimees).
-- ============================================================
update taches_assignees set projet_id = null
 where projet_id in (select id from projets_app where nom ilike '%refection toiture%');
update taches_attente set projet_id = null
 where projet_id in (select id from projets_app where nom ilike '%refection toiture%');

delete from projets_app where nom ilike '%refection toiture%';

-- Ce qui RESTE, entreprise par entreprise (verification a l'oeil) :
select entreprise_id, nom, statut, budget_total from projets_app order by entreprise_id, nom;

-- ============================================================
-- 103 - UNICITE DU CATALOGUE : PAR ENTREPRISE (2026-08-28)
-- ------------------------------------------------------------
-- BOGUE MULTI-ENTREPRISES : « duplicate key value violates unique
-- constraint idx_catalogue_items_nom » a l'import d'une liste de prix
-- chez Ventilation Miroir. L'index d'unicite portait sur le NOM SEUL,
-- pour TOUTE la base : un item nomme « Appel de service base Montreal »
-- chez DGL empechait une AUTRE entreprise de creer le sien. Un index
-- s'applique a toutes les lignes, RLS ou pas — les cloisons cachent les
-- donnees, elles ne suspendent pas les contraintes.
-- Desormais l'unicite est (entreprise_id, nom) : chacune chez soi.
-- Insensible a la casse et aux espaces de bordure, comme la
-- reconnaissance des doublons dans l'application.
-- ============================================================
-- Garde-fou : si des doublons existent DEJA dans une meme entreprise,
-- on s'arrete avec un message clair au lieu d'une erreur cryptique.
do $$
declare n int;
begin
  select count(*) into n from (
    select entreprise_id, lower(btrim(nom)) as cle
      from catalogue_items
     group by 1, 2
    having count(*) > 1
  ) doublons;
  if n > 0 then
    raise exception 'STOP : % nom(s) sont en double DANS une meme entreprise. Lance d abord la requete de diagnostic fournie dans le message, corrige-les, puis rejoue ce snippet.', n;
  end if;
end $$;

drop index if exists idx_catalogue_items_nom;
create unique index if not exists idx_catalogue_items_nom_entreprise
  on catalogue_items (entreprise_id, lower(btrim(nom)));

select indexname, indexdef
  from pg_indexes
 where schemaname = 'public' and tablename = 'catalogue_items'
 order by indexname;

-- ============================================================
-- 104 - REPONSES DE CLIENTS CLASSEES (2026-08-28)
-- ------------------------------------------------------------
-- « La modification demandee peut se perdre rapidement si on a
-- plusieurs devis envoyes en meme temps » : les reponses des clients
-- (modification demandee, accepte, refuse) se retrouvent maintenant
-- dans UN bloc en tete de l onglet Devis et sur le tableau de bord,
-- avec une pastille sur le menu.
-- La plupart se rangent TOUTES SEULES (une nouvelle version rend
-- l ancienne inactive ; traiter un devis accepte le sort de la liste).
-- Cette colonne sert aux cas regles autrement : « j ai appele le
-- client », « refus pris en note ». Additive.
-- ============================================================
alter table devis_app add column if not exists reponse_traitee_le timestamptz;
select count(*) as devis, count(reponse_traitee_le) as reponses_classees from devis_app;

-- ============================================================
-- 105 - REGISTRE DES FACTURES SANS CHANTIER (2026-08-29)
-- ------------------------------------------------------------
-- « J'ai cree 2 factures et elles n'apparaissent pas » : la facture
-- LIBRE ne vivait que dans QuickBooks et au journal — invisible dans
-- Fluxya, donc impossible a retrouver, verifier ou RENVOYER. Cette
-- table garde la trace locale ; la section « Factures sans chantier »
-- de l'onglet Facturation s'en sert (preuve d'envoi + bouton Renvoyer).
-- Nouvelle table = SES cloisons : policy d'isolation + trigger
-- d'etiquette, memes patrons que le grand soir (snippet 88).
-- ============================================================
create table if not exists factures_libres (
  id             uuid primary key default gen_random_uuid(),
  entreprise_id  text not null default 'dgl',
  qbo_invoice_id text,
  doc_number     text,
  client_id      text,
  client_nom     text,
  montant_ht     numeric,
  courriels      jsonb not null default '[]'::jsonb,
  projet_id      text,
  reference      text,
  envoi_statut   text,
  envoyee_le     timestamptz,
  created_at     timestamptz not null default now()
);

alter table factures_libres enable row level security;
drop policy if exists "iso_factures_libres" on factures_libres;
create policy "iso_factures_libres" on factures_libres
  for all to authenticated
  using (entreprise_id = public.entreprise_du_jeton())
  with check (entreprise_id = public.entreprise_du_jeton());
drop trigger if exists trg_entreprise_factures_libres on factures_libres;
create trigger trg_entreprise_factures_libres before insert on factures_libres
  for each row execute function public.poser_entreprise_id();

select indexname from pg_indexes where tablename = 'factures_libres';

-- ============================================================
-- 106 - ANNULER UN DEVIS ACCEPTE (2026-08-29)
-- ------------------------------------------------------------
-- « Si un devis revient accepte et que finalement le client annule »
-- : statut « annule » + raison + date, la PREUVE d acceptation
-- (reponse_client, nom, conditions signees) reste INTACTE — meme
-- philosophie que VOID, jamais Delete. L estimate QuickBooks passe a
-- « Rejected » automatiquement (route estimate, action rejeter).
-- Colonnes additives.
-- ============================================================
alter table devis_app add column if not exists annule_le timestamptz;
alter table devis_app add column if not exists annule_raison text;
select count(*) filter (where statut = 'annule') as devis_annules, count(*) as devis_total from devis_app;

-- ============================================================
-- 107 - CLES PAR ENTREPRISE (prix depots, taux, compteurs, fournisseurs habituels)
--       (2026-08-30)
-- ============================================================
-- MEME LECON QUE LE SNIPPET 103 (catalogue) : une cle primaire
-- s'applique a TOUTES les lignes de la base, RLS ou pas. Quatre tables
-- avaient encore une cle SANS entreprise_id :
--   prix_depots            (zone)            -> la « Zone 1 » de DGL bloquait
--                                               la sauvegarde des tarifs de
--                                               TOUTE autre entreprise
--                                               (« Echec — verifie le SQL 08 »
--                                               chez Ventilation Miroir) ;
--   taux_metiers           (metier, niveau)  -> meme blocage sur la grille
--                                               des taux horaires ;
--   compteurs              (cle)             -> PIRE : le compteur de devis
--                                               etait PARTAGE — Miroir a
--                                               emis DEV-3518 en continuant
--                                               la sequence de DGL ;
--   articles_fournisseurs  (article)         -> memoire du « fournisseur
--                                               habituel » partagee.
-- Chaque cle devient (entreprise_id, ...). AUCUNE ligne n'est modifiee
-- ni supprimee : on ne change que la regle d'unicite. Idempotent —
-- chaque bloc verifie si entreprise_id fait deja partie de la cle.

do $$
declare pk text;
begin
  -- prix_depots : (zone) -> (entreprise_id, zone)
  select tc.constraint_name into pk
    from information_schema.table_constraints tc
   where tc.table_schema = 'public' and tc.table_name = 'prix_depots'
     and tc.constraint_type = 'PRIMARY KEY';
  if pk is not null and not exists (
      select 1 from information_schema.key_column_usage k
       where k.table_schema = 'public' and k.table_name = 'prix_depots'
         and k.constraint_name = pk and k.column_name = 'entreprise_id') then
    execute format('alter table public.prix_depots drop constraint %I', pk);
    alter table public.prix_depots add primary key (entreprise_id, zone);
  end if;

  -- taux_metiers : (metier, niveau) -> (entreprise_id, metier, niveau)
  select tc.constraint_name into pk
    from information_schema.table_constraints tc
   where tc.table_schema = 'public' and tc.table_name = 'taux_metiers'
     and tc.constraint_type = 'PRIMARY KEY';
  if pk is not null and not exists (
      select 1 from information_schema.key_column_usage k
       where k.table_schema = 'public' and k.table_name = 'taux_metiers'
         and k.constraint_name = pk and k.column_name = 'entreprise_id') then
    execute format('alter table public.taux_metiers drop constraint %I', pk);
    alter table public.taux_metiers add primary key (entreprise_id, metier, niveau);
  end if;

  -- compteurs : (cle) -> (entreprise_id, cle)
  select tc.constraint_name into pk
    from information_schema.table_constraints tc
   where tc.table_schema = 'public' and tc.table_name = 'compteurs'
     and tc.constraint_type = 'PRIMARY KEY';
  if pk is not null and not exists (
      select 1 from information_schema.key_column_usage k
       where k.table_schema = 'public' and k.table_name = 'compteurs'
         and k.constraint_name = pk and k.column_name = 'entreprise_id') then
    execute format('alter table public.compteurs drop constraint %I', pk);
    alter table public.compteurs add primary key (entreprise_id, cle);
  end if;

  -- articles_fournisseurs : (article) -> (entreprise_id, article)
  select tc.constraint_name into pk
    from information_schema.table_constraints tc
   where tc.table_schema = 'public' and tc.table_name = 'articles_fournisseurs'
     and tc.constraint_type = 'PRIMARY KEY';
  if pk is not null and not exists (
      select 1 from information_schema.key_column_usage k
       where k.table_schema = 'public' and k.table_name = 'articles_fournisseurs'
         and k.constraint_name = pk and k.column_name = 'entreprise_id') then
    execute format('alter table public.articles_fournisseurs drop constraint %I', pk);
    alter table public.articles_fournisseurs add primary key (entreprise_id, article);
  end if;
end $$;

-- La numerotation des devis et bons de commande devient PAR ENTREPRISE.
-- La fonction lit l'entreprise du jeton du demandeur ; les compteurs de
-- DGL (etiquetes 'dgl' par defaut) continuent exactement ou ils sont.
create or replace function prochain_numero(cle_compteur text)
returns bigint
language plpgsql
security definer
as $$
declare
  nouveau bigint;
  ent text := coalesce(public.entreprise_du_jeton(), 'dgl');
begin
  insert into compteurs (entreprise_id, cle, valeur) values (ent, cle_compteur, 1)
  on conflict (entreprise_id, cle) do update set valeur = compteurs.valeur + 1
  returning valeur into nouveau;
  return nouveau;
end;
$$;

-- RATTRAPAGE : une entreprise qui a deja emis des devis sur le compteur
-- partage (Miroir : DEV-3518) repart de SON plus grand numero, pas de 1.
insert into compteurs (entreprise_id, cle, valeur)
select d.entreprise_id, 'devis', max(((regexp_match(d.numero_base, '\d+'))[1])::bigint)
  from devis_app d
 where d.entreprise_id <> 'dgl' and coalesce(d.numero_base, '') ~ '\d'
 group by d.entreprise_id
on conflict (entreprise_id, cle) do nothing;

-- Verification : les cles composites en place + un compteur par entreprise.
select tc.table_name, string_agg(k.column_name, ', ' order by k.ordinal_position) as cle_primaire
  from information_schema.table_constraints tc
  join information_schema.key_column_usage k
    on k.constraint_name = tc.constraint_name and k.table_schema = tc.table_schema
 where tc.table_schema = 'public' and tc.constraint_type = 'PRIMARY KEY'
   and tc.table_name in ('prix_depots', 'taux_metiers', 'compteurs', 'articles_fournisseurs')
 group by tc.table_name
union all
select 'compteurs -> ' || entreprise_id || ' / ' || cle, valeur::text from compteurs order by 1;

-- ============================================================
-- 108 - STATUT « annule_qb » ACCEPTE PAR LA TABLE DES DEPOTS
--       (2026-08-30)
-- ============================================================
-- Le pont VOID -> annulation de tache (2026-08-29) ecrit le statut
-- 'annule_qb' sur le depot quand la facture est annulee dans
-- QuickBooks. MAIS la liste fermee des statuts de la table `depots`
-- date d'avant cette fonctionnalite : la base REFUSAIT le mot, le
-- sondage avalait l'erreur en silence, et la tache restait « en
-- attente de depot » malgre le VOID (vecu par le proprietaire sur la
-- tache « test pour retour argent »). On elargit la liste — AUCUNE
-- ligne n'est modifiee, on ne change que la regle. Idempotent : le
-- bloc retire d'abord toute contrainte de verification sur `statut`,
-- quel que soit son nom, puis pose la bonne.

do $$
declare c record;
begin
  for c in
    select con.conname
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace ns on ns.oid = rel.relnamespace
     where ns.nspname = 'public' and rel.relname = 'depots'
       and con.contype = 'c'
       and pg_get_constraintdef(con.oid) ilike '%statut%'
  loop
    execute format('alter table public.depots drop constraint %I', c.conname);
  end loop;
  alter table public.depots add constraint depots_statut_check
    check (statut in ('non_requis','en_attente_paiement','paye','paye_manuellement','annule_delai','annule_qb'));
end $$;

-- Verification : la contrainte en place avec la liste complete.
select conname, pg_get_constraintdef(oid) as regle
  from pg_constraint
 where conrelid = 'public.depots'::regclass and contype = 'c';
