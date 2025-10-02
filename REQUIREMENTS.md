# Cahier des charges - Audio Comment Widget

## 1. Vue d'ensemble

Application web de partage de fichiers audio avec système de commentaires horodatés, inspirée de Soundcloud mais en version ultra-simplifiée.

**Maître mot : SIMPLICITÉ**

---

## 2. Stack technique

### Backend
- **Runtime** : Node.js
- **Framework** : Express
- **Base de données** : SQLite
- **Authentification** : HTTP Basic Auth
- **Stockage fichiers** : Filesystem local

### Frontend
- **Player audio** : WaveSurfer.js (gère nativement waveform + playback synchronisé)
- **Plugin requis** (pour WaveSurfer) : Regions (pour afficher les markers de commentaires)
- **Formats supportés** : MP3, WAV, OGG, M4A (formats supportés par WaveSurfer.js)
- **Rendering** : Vanilla JavaScript (pas de framework)
- **CSS** : CSS3 vanilla, pas de framework
- **Design** : Thème sombre, noir et blanc, minimaliste

### Génération waveform
- **Moment** : Client-side, à la volée par WaveSurfer.js
- **Pas de génération backend** : Simplicité maximale
- **Performance** : Loader affiché pendant le calcul (1-2 sec pour fichiers normaux)

---

## 3. Schéma de base de données (SQLite)

```sql
-- Table des fichiers audio
CREATE TABLE tracks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    filename TEXT NOT NULL,
    title TEXT NOT NULL,
    duration REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table des credentials (réutilisable pour tracks ET playlists)
CREATE TABLE credentials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    password TEXT NOT NULL, -- Hash bcrypt
    resource_type TEXT NOT NULL, -- 'track' ou 'playlist'
    resource_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(username, resource_type, resource_id)
);

-- Table des playlists
CREATE TABLE playlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table de liaison playlist <-> tracks
CREATE TABLE playlist_tracks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    playlist_id INTEGER NOT NULL,
    track_id INTEGER NOT NULL,
    position INTEGER NOT NULL,
    FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
    FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
    UNIQUE(playlist_id, track_id)
);

-- Table des commentaires
CREATE TABLE comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    track_id INTEGER NOT NULL,
    parent_id INTEGER, -- NULL si commentaire racine, sinon ID du parent
    timestamp REAL NOT NULL, -- Position dans le morceau (en secondes)
    username TEXT NOT NULL, -- Pseudo de l'auteur
    content TEXT NOT NULL,
    is_closed BOOLEAN DEFAULT 0, -- Thread clos ou non (uniquement pour racine)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE
);

-- Index pour performances
CREATE INDEX idx_credentials_resource ON credentials(resource_type, resource_id);
CREATE INDEX idx_comments_track ON comments(track_id);
CREATE INDEX idx_comments_parent ON comments(parent_id);
CREATE INDEX idx_comments_timestamp ON comments(track_id, timestamp);
CREATE INDEX idx_playlist_tracks_playlist ON playlist_tracks(playlist_id);
```

---

## 4. Architecture Backend - Routes API

### 4.1 Routes Admin (protégées par Basic Auth admin)

**Configuration admin** :
- Username/password définis dans un fichier `.env` ou `config.json`
- Middleware `requireAdminAuth()` vérifie les credentials

#### Tracks
```
GET    /admin/tracks              -> Liste tous les morceaux
POST   /admin/tracks              -> Upload nouveau morceau (multipart/form-data)
GET    /admin/tracks/:id          -> Détails d'un morceau
PUT    /admin/tracks/:id          -> Mise à jour (titre uniquement)
DELETE /admin/tracks/:id          -> Suppression morceau
POST   /admin/tracks/:id/regenerate-uuid -> Régénère l'UUID du morceau
```

#### Credentials (pour tracks)
```
GET    /admin/tracks/:id/credentials       -> Liste credentials d'un morceau
POST   /admin/tracks/:id/credentials       -> Ajoute credential à un morceau
DELETE /admin/tracks/:id/credentials/:credId -> Supprime credential
```

#### Playlists
```
GET    /admin/playlists           -> Liste toutes les playlists
POST   /admin/playlists           -> Crée nouvelle playlist
GET    /admin/playlists/:id       -> Détails d'une playlist
PUT    /admin/playlists/:id       -> Mise à jour playlist (titre, ordre des tracks)
DELETE /admin/playlists/:id       -> Suppression playlist
POST   /admin/playlists/:id/regenerate-uuid -> Régénère l'UUID de la playlist
POST   /admin/playlists/:id/tracks -> Ajoute un track à la playlist
DELETE /admin/playlists/:id/tracks/:trackId -> Retire un track de la playlist
```

#### Credentials (pour playlists)
```
GET    /admin/playlists/:id/credentials       -> Liste credentials d'une playlist
POST   /admin/playlists/:id/credentials       -> Ajoute credential à une playlist
DELETE /admin/playlists/:id/credentials/:credId -> Supprime credential
```

### 4.2 Routes Publiques (protégées par Basic Auth track/playlist si configuré)

#### Accès aux morceaux
```
GET    /track/:uuid               -> Page HTML du morceau
GET    /api/track/:uuid           -> Données JSON du morceau (titre, waveform, durée)
GET    /api/track/:uuid/audio     -> Stream du fichier audio
GET    /api/track/:uuid/comments  -> Liste des commentaires du morceau
POST   /api/track/:uuid/comments  -> Ajoute un commentaire racine
POST   /api/track/:uuid/comments/:commentId/reply -> Ajoute une réponse
PUT    /api/track/:uuid/comments/:commentId/close -> Clôt un thread
```

#### Accès aux playlists
```
GET    /playlist/:uuid            -> Page HTML de la playlist
GET    /api/playlist/:uuid        -> Données JSON de la playlist (titre, liste des tracks)
```

---

## 5. Système d'authentification

### 5.1 Admin Auth
- Middleware `requireAdminAuth()`
- Vérifie header `Authorization: Basic <base64>`
- Compare avec credentials admin définis dans config
- Retourne 401 si échec

### 5.2 Resource Auth (Track/Playlist)
- Middleware `requireResourceAuth(resourceType, getResourceIdFromUuid)`
- Récupère l'UUID depuis les params de la route
- Vérifie si des credentials existent pour cette ressource
- Si OUI : vérifie header `Authorization: Basic <base64>`
  - Si header absent ou invalide : retourne 403
  - Si valide : permet l'accès
- Si NON : retourne 403 (pas de credentials = pas d'accès)

### 5.3 Logique credentials Playlist
- Quand on accède à `/playlist/:uuid` :
  - Auth via credentials de la playlist
  - Une fois authentifié, les sous-routes `/api/track/:trackUuid/*` utilisent le même context d'auth
  - Les tracks individuels ne demandent PAS leurs propres credentials dans ce contexte
- Quand on accède à `/track/:uuid` directement :
  - Auth via credentials du track

**Implémentation** : Session temporaire (cookie ou token en mémoire) qui mémorise l'authentification playlist pour ne pas redemander les credentials à chaque appel API vers les tracks.

---

## 6. Widgets détaillés

### 6.1 Widget `CredentialManager`

**Responsabilité** : Gérer les credentials d'une ressource (track ou playlist)

**Props/Config** :
```javascript
{
  resourceType: 'track' | 'playlist',
  resourceId: number,
  apiEndpoint: string // ex: '/admin/tracks/5/credentials'
}
```

**Fonctionnalités** :
- Affiche la liste des credentials existants (username uniquement)
- Formulaire d'ajout : `username` + `password`
- Bouton de suppression pour chaque credential
- Appels API :
  - GET pour charger la liste
  - POST pour ajouter
  - DELETE pour supprimer

**UI** :
```
┌─────────────────────────────────────┐
│ Credentials                         │
├─────────────────────────────────────┤
│ • john.doe        [Supprimer]       │
│ • jane.smith      [Supprimer]       │
├─────────────────────────────────────┤
│ Ajouter un credential               │
│ Username: [________]                │
│ Password: [________]                │
│           [Ajouter]                 │
└─────────────────────────────────────┘
```

### 6.2 Widget `AudioCommentPlayer`

**Responsabilité** : Player audio avec waveform interactive et commentaires horodatés

**Props/Config** :
```javascript
{
  trackUuid: string,
  username: string, // Username du credential utilisé (ou "anonymous")
  apiEndpoint: string // ex: '/api/track/abc123'
}
```

**Fonctionnalités** :

#### Affichage
- Waveform générée avec WaveSurfer.js
- Barre de progression synchronisée avec la lecture
- Barres verticales rouges aux timestamps des commentaires **non-clos**
- Contrôles de lecture : Play/Pause, position actuelle / durée totale

#### Interactions
1. **Clic sur waveform (zone vide)** :
   - Affiche modal/formulaire de commentaire
   - Pré-remplit le pseudo avec `username` (éditable)
   - Champ texte pour le commentaire
   - Bouton "Publier" → POST `/api/track/:uuid/comments`

2. **Clic sur barre verticale (commentaire existant)** :
   - Affiche le thread de commentaires en overlay/sidebar
   - Thread = commentaire racine + toutes ses réponses (ordre chrono)
   - Chaque commentaire affiche : pseudo, timestamp, contenu, date de création
   - Bouton "Répondre" sur chaque commentaire
   - Bouton "Clôturer le thread" sur le commentaire racine (si pas déjà clos)

3. **Bouton "Afficher commentaires clos"** :
   - Toggle pour afficher/masquer les barres verticales des threads clos
   - Les threads clos apparaissent en grisé/semi-transparent

#### Formulaire de réponse (réutilisable)
- Même structure que le formulaire de commentaire racine
- Pré-remplit le pseudo avec `username` (éditable)
- POST `/api/track/:uuid/comments/:commentId/reply`

**UI Schématique** :
```
┌────────────────────────────────────────────────┐
│ [▶] 00:34 / 03:45                              │
├────────────────────────────────────────────────┤
│        Waveform (WaveSurfer.js)                │
│    │                │           │              │
│    │     Barres     │           │ Commentaires │
│════╪════════════════╪═══════════╪══════════════│ <- Progression
│    │                │           │              │
├────────────────────────────────────────────────┤
│ [Afficher commentaires clos]                   │
└────────────────────────────────────────────────┘

// Au clic sur barre verticale :
┌───────────────────────────────────┐
│ Commentaires à 01:23              │
├───────────────────────────────────┤
│ @john.doe (12/01/2025 14:32)      │
│ Super passage !                   │
│          [Répondre]               │
│                                   │
│   └─ @jane (12/01/2025 14:35)     │
│      Carrément ! 🔥               │
│              [Répondre]           │
│                                   │
│ [Clôturer le thread]              │
└───────────────────────────────────┘
```

### 6.3 Widget `CommentThread`

**Responsabilité** : Affichage d'un thread de commentaires (racine + réponses)

**Props/Config** :
```javascript
{
  rootComment: Comment,
  replies: Comment[],
  currentUsername: string,
  trackUuid: string,
  onReply: (parentId, content, username) => void,
  onClose: (commentId) => void
}
```

**Fonctionnalités** :
- Affiche le commentaire racine
- Affiche toutes les réponses en arborescence indentée
- Formulaire de réponse réutilisable sous chaque commentaire
- Bouton "Clôturer" uniquement sur le commentaire racine

---

## 7. Pages détaillées

### 7.1 Page Admin `/admin`

**Authentification** : Basic Auth admin

**Sections** :

#### Section "Tracks"
- Tableau listant tous les morceaux :
  - Titre
  - UUID (cliquable → ouvre le lien public)
  - Nombre de credentials
  - Actions : [Éditer] [Supprimer] [Régénérer UUID]
- Bouton "Upload nouveau morceau"
  - Formulaire : Fichier audio + Titre
  - Au submit : upload → enregistrement DB

#### Section "Playlists"
- Tableau listant toutes les playlists :
  - Titre
  - UUID (cliquable → ouvre le lien public)
  - Nombre de tracks
  - Nombre de credentials
  - Actions : [Éditer] [Supprimer] [Régénérer UUID]
- Bouton "Créer nouvelle playlist"

### 7.2 Modale "Éditer morceau"

- Formulaire :
  - Titre (éditable)
  - Widget `CredentialManager` (resourceType='track')
- Bouton "Sauvegarder"

### 7.3 Modale "Éditer playlist"

- Formulaire :
  - Titre (éditable)
  - Liste des tracks (drag & drop pour réordonner)
  - Bouton "Ajouter un morceau" → sélection parmi morceaux existants
  - Widget `CredentialManager` (resourceType='playlist')
- Bouton "Sauvegarder"

### 7.4 Page Playlist `/playlist/:uuid`

**Authentification** : Basic Auth playlist (si configuré)

**Structure** :
```
┌─────────────────────────────────────────────┐
│ [Logo/Titre App]                            │
├─────────┬───────────────────────────────────┤
│ Sidebar │ Zone principale                   │
│         │                                   │
│ • Track │ Widget AudioCommentPlayer         │
│   1     │ (track actuellement sélectionné)  │
│ • Track │                                   │
│   2     │                                   │
│ • Track │                                   │
│   3     │                                   │
│         │                                   │
└─────────┴───────────────────────────────────┘
```

**Fonctionnement** :
- Sidebar : liste cliquable des tracks de la playlist
- Au clic sur un track : charge le widget AudioCommentPlayer pour ce track
- La sidebar reste visible en permanence
- Premier track chargé par défaut

### 7.5 Page Morceau `/track/:uuid`

**Authentification** : Basic Auth track

**Structure** :
```
┌─────────────────────────────────────────────┐
│ [Logo/Titre App]                            │
├─────────────────────────────────────────────┤
│                                             │
│ Widget AudioCommentPlayer                   │
│ (track unique)                              │
│                                             │
│                                             │
└─────────────────────────────────────────────┘
```

**Fonctionnement** :
- Affichage du widget AudioCommentPlayer uniquement
- Pas de sidebar, pas de navigation

---

## 8. Flows utilisateur

### 8.1 Flow Admin - Upload d'un morceau

1. Admin accède à `/admin` (auth admin)
2. Clic sur "Upload nouveau morceau"
3. Sélectionne fichier + saisit titre
4. Submit → Backend :
   - Génère UUID unique
   - Sauvegarde fichier dans `/uploads/audio/:uuid.mp3`
   - Insert en DB
5. Redirection vers liste des morceaux

### 8.2 Flow Admin - Ajout de credentials à un morceau

1. Admin clique sur "Éditer" d'un morceau
2. Modale s'ouvre avec Widget `CredentialManager`
3. Admin remplit username + password
4. Submit → Backend :
   - Hash le password (bcrypt)
   - Insert en DB
5. Credential apparaît dans la liste

### 8.3 Flow Public - Accès à un morceau protégé

1. User accède à `/track/:uuid`
2. Backend vérifie si des credentials existent
3. Si OUI :
   - Navigateur affiche popup Basic Auth
   - User saisit username + password
   - Backend valide
   - Si OK → affiche page
   - Si KO → 403
4. Si NON :
   - 403

### 8.4 Flow Public - Ajout d'un commentaire

1. User clique sur waveform (zone vide)
2. Modal s'ouvre :
   - Pseudo pré-rempli avec username du credential
   - Champ texte vide
3. User édite pseudo (si besoin) et saisit commentaire
4. Clic "Publier" → POST `/api/track/:uuid/comments`
   - Body : `{ timestamp, username, content }`
5. Backend insert en DB
6. Frontend rafraîchit les commentaires
7. Barre verticale apparaît sur la waveform

### 8.5 Flow Public - Réponse à un commentaire

1. User clique sur barre verticale
2. Thread s'affiche avec tous les commentaires
3. User clique sur "Répondre" sous un commentaire
4. Formulaire apparaît (pseudo éditable + champ texte)
5. User saisit réponse
6. Submit → POST `/api/track/:uuid/comments/:commentId/reply`
7. Backend insert en DB avec `parent_id`
8. Frontend rafraîchit le thread

### 8.6 Flow Public - Clôture d'un thread

1. User clique sur "Clôturer le thread" (commentaire racine)
2. Confirmation rapide (optionnel)
3. PUT `/api/track/:uuid/comments/:commentId/close`
4. Backend met à jour `is_closed = 1`
5. Frontend masque la barre verticale sur la waveform
6. Le thread n'est plus visible sauf si "Afficher commentaires clos" activé

---

## 9. Détails techniques importants

### 9.1 Gestion de l'authentification playlist → tracks

**Approche simple avec cookie de session** :

1. User s'authentifie sur `/playlist/:uuid`
2. Backend crée une session temporaire (express-session)
3. Stocke dans session : `playlistAuth = { playlistUuid, authenticatedAt }`
4. Pour chaque requête vers `/api/track/:trackUuid/*` depuis le context playlist :
   - Middleware vérifie si le track appartient à une playlist dont l'UUID est dans la session
   - Si OUI : skip l'auth track
   - Si NON : auth track normale

---

## 10. Design System & Guidelines visuelles

### 10.1 Palette de couleurs

**Couleurs principales** : Le site devra implémenter un style sobre noir et blanc.

### 10.2 Typographie

On préférera des polices monospace telles que Monaco.

### 10.3 Layout général

**Principe** : Espaces généreux, pas de couleurs vives, focus sur le contenu.

### 10.4 Page Admin - Style

**Principe** : Interface type "terminal", très épurée, tableaux simples.

## 11. Checklist d'implémentation

### Phase 0 : Setup & Design
- [ ] Init projet Node.js + Express
- [ ] Setup structure dossiers
- [ ] CSS reset + variables design system
- [ ] Composants CSS de base (buttons, inputs, cards)
- [ ] Templates HTML de base (admin, track, playlist)

### Phase 1 : Backend Core
- [ ] Setup Express + SQLite
- [ ] Schéma DB + migrations
- [ ] Configuration admin (env/config file)
- [ ] Middleware `adminAuth`
- [ ] Middleware `resourceAuth`

### Phase 2 : Admin - Tracks
- [ ] Routes CRUD tracks
- [ ] Upload + stockage fichiers
- [ ] Régénération UUID
- [ ] Service audioService
- [ ] Interface admin tracks (HTML + JS)

### Phase 3 : Admin - Credentials
- [ ] Routes credentials (réutilisables)
- [ ] Composant `CredentialManager` (vanilla JS)
- [ ] Intégration dans admin tracks
- [ ] Styles CSS credentials

### Phase 4 : Admin - Playlists
- [ ] Routes CRUD playlists
- [ ] Liaison tracks <-> playlists
- [ ] Régénération UUID
- [ ] Composant `CredentialManager` pour playlists
- [ ] Interface admin playlists (HTML + JS)
- [ ] Styles CSS playlists

### Phase 5 : Public - Player
- [ ] Page `/track/:uuid` (HTML)
- [ ] Composant `AudioCommentPlayer` (vanilla JS)
- [ ] Intégration WaveSurfer.js
- [ ] Lecture audio + waveform synchronisée
- [ ] Styles CSS player + waveform
- [ ] Affichage barres verticales commentaires

### Phase 6 : Public - Commentaires
- [ ] Routes API commentaires
- [ ] Formulaire ajout commentaire (HTML + JS)
- [ ] Composant `CommentThread` (vanilla JS)
- [ ] Réponses aux commentaires
- [ ] Clôture de threads
- [ ] Toggle "Afficher clos"
- [ ] Styles CSS commentaires

### Phase 7 : Public - Playlists
- [ ] Page `/playlist/:uuid` (HTML)
- [ ] Sidebar navigation tracks (HTML + CSS)
- [ ] Script playlist.js
- [ ] Intégration `AudioCommentPlayer`
- [ ] Gestion auth playlist → tracks

### Phase 8 : Polish
- [ ] Composant Modal réutilisable
- [ ] Gestion erreurs (403, 404, 500)
- [ ] Validation inputs
- [ ] Tests manuels flows complets
- [ ] Responsive mobile
- [ ] Documentation README

---

## 12. Points d'attention

1. **Sécurité passwords** : TOUJOURS hasher avec bcrypt (cost factor 10+)
2. **Validation inputs** : Sanitize tous les inputs utilisateur (notamment `username` et `content`)
3. **UUID collision** : Utiliser uuid v4 (très faible probabilité de collision)
4. **Stockage audio** : Prévoir limite de taille fichier (ex: 50MB max)
5. **Loader waveform** : Afficher un indicateur de chargement pendant la génération client-side
6. **Session playlist** : Durée de vie session à définir (ex: 24h)
7. **Commentaires malveillants** : Prévoir limite de longueur (ex: 500 caractères)
8. **Vanilla JS** : Pas de bundler nécessaire, charger les scripts dans l'ordre, utiliser les dernières normes ES6
9. **Design sobre** : Pas d'animations flashy, transitions subtiles uniquement (0.2s max)
