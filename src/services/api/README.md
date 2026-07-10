# 📡 Services API

Ce dossier contient tous les services pour communiquer avec le backend EDC Track.

## 🏗️ Structure

```
api/
├── client.ts              # Configuration Axios + intercepteurs
├── transformers.ts        # Transformation FR ↔ EN
├── authService.ts         # Authentification (avec transformation)
├── userService.ts         # Gestion utilisateurs (avec transformation)
├── projectService.ts      # Gestion projets
├── documentService.ts     # Gestion documents
├── teamService.ts         # Affectations équipe
├── alertService.ts        # Gestion alertes
├── dashboardService.ts    # Statistiques dashboard
├── healthService.ts       # Health check
└── index.ts              # Export centralisé
```

## 🔄 Transformation automatique

### Pourquoi ?
Le backend utilise des noms en français (`prenom`, `nom`, etc.) mais le frontend utilise l'anglais (`firstName`, `lastName`, etc.).

### Comment ?
Les services `authService` et `userService` utilisent automatiquement les transformateurs pour convertir les données.

### Exemple
```typescript
// Vous écrivez (frontend)
await userService.create({
  firstName: 'Jean',
  lastName: 'Dupont',
  phone: '+237...',
  position: 'Chef',
  department: 'IT',
  status: 'active'
});

// Le service envoie au backend
{
  prenom: 'Jean',
  nom: 'Dupont',
  telephone: '+237...',
  fonction: 'Chef',
  departement: 'IT',
  statut: 'actif'
}

// Le backend répond
{
  prenom: 'Jean',
  nom: 'Dupont',
  ...
}

// Vous recevez (frontend)
{
  firstName: 'Jean',
  lastName: 'Dupont',
  ...
}
```

## 📦 Utilisation

### Import
```typescript
import { userService, getErrorMessage } from '@/services/api';
```

### Pattern recommandé
```typescript
const [data, setData] = useState<Type[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

const fetchData = async () => {
  try {
    setLoading(true);
    setError(null);
    const result = await service.getAll();
    setData(result);
  } catch (err: any) {
    setError(getErrorMessage(err));
  } finally {
    setLoading(false);
  }
};

useEffect(() => { fetchData(); }, []);
```

## 🔐 Authentification

Le token JWT est automatiquement:
- Ajouté aux requêtes (intercepteur request)
- Stocké dans `sessionStorage`
- Vérifié à chaque requête
- Supprimé en cas d'erreur 401 (redirection vers `/login`)

## 🛠️ Configuration

### Variables d'environnement
```bash
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

### Backend
```bash
# backend/.env
PORT=4000
CORS_ORIGIN=http://localhost:3000
```

## 📝 Règles

1. ✅ Toujours utiliser les noms anglais dans le frontend
2. ✅ Utiliser `getErrorMessage()` pour les erreurs
3. ✅ Ajouter loading/error states
4. ✅ Ne jamais appeler les transformateurs manuellement
5. ❌ Ne jamais utiliser les noms français dans le code frontend

## 🧪 Tests

Voir `frontend/TEST_API_INTEGRATION.md` pour les tests complets.

## 📚 Documentation

- Guide complet: `/INTEGRATION_API_COMPLETE.md`
- Exemples: `/frontend/EXAMPLE_API_USAGE.tsx`
- Référence rapide: `/QUICK_REFERENCE.md`
