# Branches et mises en production

Deux dépôts suivent la même règle : `edc-track-frontend` (cette interface) et
`edc-track-api` (le serveur).

## Les branches

| Branche | Rôle | Déploiement |
|---|---|---|
| `main` | Ce qui tourne en production. On n'y pousse jamais directement. | Site de production (Vercel) |
| `dev` | Tout ce qui est terminé et validé, en attente de mise en production. | Site de dev (Vercel, déploiement de préversion) |
| `feat/…`, `fix/…` | Une fonctionnalité ou une correction à la fois. | Un déploiement de préversion par branche |

## Le trajet d'une fonctionnalité

1. Partir de `dev` : `git switch dev && git pull && git switch -c feat/mon-sujet`
2. Travailler, vérifier avec `npx tsc --noEmit`, `npx eslint src` et `npm run build`.
3. Pousser la branche, puis ouvrir une **pull request vers `dev`** sur GitHub.
4. Relire le déploiement de préversion que Vercel publie sur la pull request, puis fusionner.

## Une mise en production

Quand `dev` est jugée bonne :

1. Ouvrir une pull request **`dev` → `main`**, intitulée par exemple « Mise en production du 16 septembre ».
2. Relire la liste des changements : c'est la dernière occasion de voir tout ce qui part.
3. Fusionner. Vercel déploie la production automatiquement.
4. Si le serveur a lui aussi des changements, **fusionner d'abord `dev` → `main` côté API**,
   puis l'interface : une interface qui appelle une API plus ancienne échoue.

Rien ne se perd entre deux mises en production : on continue à empiler les fonctionnalités
sur `dev` pendant que `main` reste stable.

## Attention aux données

Le site de dev parle à **l'API de production** : ce que vous créez, modifiez ou
supprimez depuis le site de dev touche les **vraies données**. Tant qu'une API de dev
avec sa propre base n'existe pas, ne testez les suppressions et les créations en masse
qu'en local, avec un serveur lancé sur votre machine.
