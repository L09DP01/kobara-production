# API Keys

Les API Keys permettent à votre application de communiquer de manière sécurisée avec l’infrastructure Kobara.

Chaque requête envoyée à l’API Kobara doit être authentifiée avec une clé API valide.

Les clés API permettent :

* créer des paiements ;
* générer des liens de paiement ;
* effectuer des retraits ;
* gérer les webhooks ;
* accéder aux données du dashboard ;
* utiliser les SDK Kobara.

---

## Types de clés API

Kobara fournit deux catégories de clés :

| Type       | Utilisation           |
| ---------- | --------------------- |
| Public Key | Frontend / Checkout   |
| Secret Key | Backend / API serveur |

---

## Public Keys

Les clés publiques sont utilisées côté client.

Exemples :

* React ;
* Next.js ;
* Vue ;
* applications mobiles ;
* checkout frontend ;
* SDK JavaScript.

Préfixes :

```txt id="mpd76o"
kbr_pk_test_
kbr_pk_live_
```

---

## Exemple Public Key

```txt id="mujbhn"
kbr_pk_test_xxxxxxxxx
```

---

## Cas d’utilisation

### Initialiser le SDK

```js id="fyicjh"
const kobara = new Kobara(
  process.env.NEXT_PUBLIC_KOBARA_PUBLIC_KEY
);
```

---

## Important

✅ Peut être utilisée dans le navigateur
✅ Utilisée pour lancer le checkout
❌ Ne permet pas d’effectuer des retraits
❌ Ne donne pas accès aux données sensibles
❌ Ne doit pas remplacer le backend

---

## Secret Keys

Les clés secrètes permettent d’effectuer des actions sensibles.

Elles doivent être utilisées uniquement :

* côté serveur ;
* dans les API routes ;
* dans le backend ;
* dans les workers ;
* dans les webhooks.

Préfixes :

```txt id="2p7uoz"
kbr_sk_test_
kbr_sk_live_
```

---

## Exemple Secret Key

```txt id="r82o8n"
kbr_sk_test_VOTRE_CLE_API
```

---

## Important

⚠️ Les Secret Keys ne doivent jamais être exposées dans :

* React ;
* Next.js client ;
* mobile app ;
* navigateur ;
* GitHub ;
* HTML ;
* JavaScript public.

---

## Architecture recommandée

### Correct

```txt id="zyum7u"
Client
↓
Votre backend
↓
API Kobara
↓
MonCash/MonCash
```

---

## Incorrect

```txt id="zaxp8q"
Client
↓
Secret Key Kobara
```

---

## Environnements

Kobara supporte deux environnements.

| Mode | Description       |
| ---- | ----------------- |
| Test | Développement     |
| Live | Production réelle |

---

## Test Mode

Utilisé pour :

* développement ;
* tests ;
* simulation paiements ;
* tests webhooks.

Clés :

```txt id="cf4y2z"
kbr_pk_test_
kbr_sk_test_
```

---

## Live Mode

Utilisé pour :

* vrais paiements ;
* vrais retraits ;
* production.

Clés :

```txt id="pt0ynm"
kbr_pk_live_
kbr_sk_live_
```

---

## Créer une clé API

Dans votre dashboard Kobara :

```txt id="e6m2sl"
Dashboard → API Keys
```

Vous pouvez :

* créer ;
* régénérer ;
* désactiver ;
* supprimer ;
* limiter ;
* renommer vos clés.

---

## Informations disponibles

Chaque clé contient :

| Champ        | Description           |
| ------------ | --------------------- |
| id           | Identifiant unique    |
| name         | Nom personnalisé      |
| type         | public ou secret      |
| environment  | test ou live          |
| created_at   | Date création         |
| last_used_at | Dernière utilisation  |
| permissions  | Permissions associées |

---

## Permissions des clés

Les clés peuvent être limitées à certaines actions.

| Permission        | Description         |
| ----------------- | ------------------- |
| payments.write    | Créer paiements     |
| payments.read     | Lire paiements      |
| links.write       | Créer payment links |
| withdrawals.write | Créer retraits      |
| webhooks.write    | Gérer webhooks      |
| analytics.read    | Lire analytics      |

---

## Exemple permissions limitées

```json id="c17hnn"
{
  "permissions": [
    "payments.write",
    "payments.read"
  ]
}
```

---

## Régénération des clés

Vous pouvez régénérer une clé à tout moment.

⚠️ Après régénération :

* l’ancienne clé devient invalide ;
* toutes les applications utilisant cette clé doivent être mises à jour.

---

## Désactivation des clés

Les clés peuvent être :

* suspendues ;
* réactivées ;
* supprimées.

Utile en cas :

* de fuite ;
* de compromission ;
* de rotation sécurité.

---

## Rotation des clés

Kobara recommande :

✅ rotation régulière des clés
✅ séparation test/live
✅ permissions minimales
✅ surveillance des usages

---

## Variables d’environnement

### Frontend

```env id="v6n3d7"
NEXT_PUBLIC_KOBARA_PUBLIC_KEY=
```

---

### Backend

```env id="yy0kxm"
KOBARA_SECRET_KEY=
```

---

## Exemple Node.js

```js id="my10xk"
import Kobara from "kobara";

const kobara = new Kobara({
  secretKey: process.env.KOBARA_SECRET_KEY
});
```

---

## Exemple cURL

```bash id="rz5ptv"
curl https://api.kobara.app/api/v1/payments \
  -H "Authorization: Bearer kbr_sk_live_VOTRE_CLE_API" \
  -H "Content-Type: application/json"
```

---

## Limitation IP (optionnel)

Les clés peuvent être limitées :

* à certaines IPs ;
* certains serveurs ;
* certains domaines.

---

## Monitoring & Logs

Kobara enregistre :

* IP ;
* timestamp ;
* endpoint ;
* statut ;
* usage ;
* erreurs.

Disponible dans :

* Dashboard
* Audit Logs
* Analytics

---

## Exemple réponse API Key

```json id="brv8dr"
{
  "id": "key_01",
  "name": "Production Server",
  "type": "secret",
  "environment": "live",
  "prefix": "kbr_sk_live_",
  "created_at": "2026-05-09T12:00:00Z"
}
```

---

## Bonnes pratiques sécurité

### À faire

✅ stocker les clés dans `.env`
✅ utiliser HTTPS
✅ limiter permissions
✅ régénérer régulièrement
✅ utiliser backend pour actions sensibles
✅ séparer test et production

---

### À ne jamais faire

❌ exposer Secret Key dans React
❌ publier sur GitHub
❌ envoyer Secret Key au navigateur
❌ stocker dans localStorage
❌ utiliser la même clé partout

---

## Utilisation recommandée

### Frontend

Utiliser :

* Public Key ;
* SDK JavaScript ;
* checkout Kobara.

---

### Backend

Utiliser :

* Secret Key ;
* API Kobara ;
* webhooks ;
* retraits ;
* analytics.




