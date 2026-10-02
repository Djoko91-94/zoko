# Configuration production (FR) - rapide

## 1) Choisir ton hebergeur

- Render: utilise .env.render.production.example
- Railway: utilise .env.railway.production.example

## 2) Renseigner les variables

- DATABASE_URL: URL PostgreSQL fournie par l'hebergeur
- ALLOWED_ORIGINS: domaine frontend autorise
- RATE_LIMIT_WINDOW_MS: fenetre de limitation (ms)
- RATE_LIMIT_MAX: nombre max de requetes dans la fenetre
- RESEND_API_KEY / RESEND_FROM_EMAIL: seulement si tu veux les emails de rappel

## 3) Lancer la migration (une seule fois)

npm run migrate:postgres

## 4) Demarrer le backend en production

npm run start:backend

## 5) Verifications obligatoires

- GET /api/health retourne status=ok
- Inscription et connexion fonctionnent
- Ajout/modification/suppression de taches fonctionnent
- Logout fonctionne

## 6) Regle importante

En production, n'utilise pas ALLOWED_ORIGINS=*.
Mets uniquement ton vrai domaine frontend.
