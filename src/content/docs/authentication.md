# Authentification API MonCash et API NatCash

Cette page explique comment authentifier vos appels **API MonCash**, **MonCash API**, **API NatCash** et **NatCash API** via Kobara.

L’API Kobara utilise un système d’authentification sécurisé basé sur des clés API afin de protéger les paiements, les retraits et toutes les opérations sensibles effectuées sur votre compte marchand.

Toutes les requêtes envoyées à l’API Kobara doivent être authentifiées avec un Bearer Token.

---

## Base URL API

### Test Mode

```txt id="5j4wqk"
https://api.kobara.app
```

---

### Live Mode

```txt id="9w4wwd"
https://api.kobara.app
```

---

## HTTPS Obligatoire

⚠️ Toutes les requêtes doivent être effectuées via HTTPS.

Les requêtes HTTP non sécurisées sont automatiquement refusées afin de protéger :

* les paiements ;
* les données clients ;
* les clés API ;
* les transactions MonCash / NatCash ;
* les webhooks.

---

## Types de clés API

Kobara fournit deux types de clés :

| Type       | Utilisation       |
| ---------- | ----------------- |
| Public Key | Frontend / mobile |
| Secret Key | Backend / serveur |

---

## Clés Publiques

Les clés publiques sont utilisées :

* dans le frontend ;
* dans les applications React ;
* dans les applications mobiles ;
* dans le SDK JavaScript ;
* pour initialiser le checkout Kobara.

Préfixes :

```txt id="6y3oz7"
kbr_pk_test_
kbr_pk_live_
```

---

## Exemple clé publique

```txt id="x16y2t"
kbr_pk_test_xxxxxxxxx
```

---

## Utilisation recommandée

Frontend React :

```js id="x6c6m7"
const kobara = new Kobara(
  process.env.NEXT_PUBLIC_KOBARA_PUBLIC_KEY
);
```

---

## Important

✅ Peut être exposée côté client
✅ Utilisée uniquement pour initialiser le paiement
❌ Ne peut pas effectuer d’actions sensibles
❌ Ne peut pas effectuer de retraits
❌ Ne peut pas accéder aux données privées

---

## Clés Secrètes

Les clés secrètes permettent :

* créer des paiements ;
* effectuer des retraits ;
* rembourser ;
* accéder aux données sensibles ;
* gérer les webhooks ;
* effectuer des actions serveur.

Préfixes :

```txt id="rf12ko"
kbr_sk_test_
kbr_sk_live_
```

---

## Exemple clé secrète

```txt id="9h1z9e"
kbr_sk_test_VOTRE_CLE_API
```

---

## Important

⚠️ Les clés secrètes doivent toujours rester côté serveur.

Ne jamais :

* exposer dans le frontend ;
* envoyer au navigateur ;
* stocker dans du code public ;
* publier sur GitHub.

---

## Architecture sécurisée recommandée

## Correct

```txt id="7dq0jk"
Frontend
↓
Votre backend sécurisé
↓
API Kobara
↓
MonCash / MonCash
```

---

## Incorrect

```txt id="7x7kmu"
Frontend
↓
MonCash directement
```

ou :

```txt id="n4kql4"
Frontend
↓
Kobara Secret Key
```

---

## Authentification Bearer Token

Toutes les requêtes doivent inclure :

```http id="5nnhkl"
Authorization: Bearer VOTRE_SECRET_KEY
```

---

## Exemple cURL

```bash id="0s5r5z"
curl https://api.kobara.app/api/v1/payments \
  -H "Authorization: Bearer kbr_sk_test_VOTRE_CLE_API" \
  -H "Content-Type: application/json"
```

---

## Exemple avec fetch()

```js id="kn5bsv"
const response = await fetch(
  "https://api.kobara.app/api/v1/payments",
  {
    method: "POST",

    headers: {
      "Authorization":
        `Bearer ${process.env.KOBARA_SECRET_KEY}`,

      "Content-Type": "application/json"
    },

    body: JSON.stringify({
      amount: 1000,
      currency: "HTG"
    })
  }
);
```

---

## Exemple Node.js

```js id="x92j5u"
import Kobara from "kobara";

const kobara = new Kobara({
  secretKey: process.env.KOBARA_SECRET_KEY
});
```

---

## Environnements

Kobara supporte :

| Environment | Description       |
| ----------- | ----------------- |
| Test        | Développement     |
| Live        | Production réelle |

---

## Test Mode

Le mode test permet :

* tester les paiements ;
* tester les webhooks ;
* développer sans argent réel ;
* valider les intégrations.

Utiliser :

```txt id="w0hryg"
kbr_pk_test_
kbr_sk_test_
```

---

## Live Mode

Le mode live permet :

* paiements réels ;
* retraits réels ;
* transactions MonCash réelles.

Utiliser :

```txt id="lckzku"
kbr_pk_live_
kbr_sk_live_
```



## Rotation des clés

Kobara permet :

* régénération des clés ;
* désactivation ;
* révocation immédiate ;
* gestion multi-clés.

Disponible dans :

```txt id="4pp1qo"
Dashboard → API Keys
```

---

## Permissions des clés

Certaines clés peuvent être limitées :

| Permission        | Description     |
| ----------------- | --------------- |
| payments.write    | Créer paiements |
| payments.read     | Lire paiements  |
| withdrawals.write | Créer retraits  |
| webhooks.write    | Gérer webhooks  |

---

## Expiration des clés

Les clés API peuvent :

* expirer automatiquement ;
* être limitées par IP ;
* être désactivées manuellement.

---

## Sécurité recommandée

## À faire

✅ Utiliser HTTPS
✅ Stocker les secrets dans `.env`
✅ Vérifier les webhooks
✅ Utiliser le backend pour les actions sensibles
✅ Activer logs et monitoring
✅ Régénérer clés compromises

---

## À ne jamais faire

❌ exposer Secret Key côté client
❌ hardcoder les secrets dans React
❌ publier les clés dans GitHub
❌ utiliser localStorage pour les secrets
❌ appeler MonCash directement depuis le frontend

---

## Bonnes pratiques Kobara

En tant que marchand Kobara :

Vous ne devez jamais interagir directement avec l’infrastructure MonCash/MonCash.

Votre système doit communiquer uniquement avec :

* l’API Kobara ;
* les SDK Kobara ;
* les webhooks Kobara.

Kobara agit comme :

* couche de sécurité ;
* couche d’abstraction ;
* couche de monitoring ;
* infrastructure de paiement unifiée.

---

## Exemple architecture complète

```txt id="0yrzkg"
Client
↓
Frontend App
↓
Kobara SDK
↓
Votre Backend
↓
Kobara API
↓
MonCash Infrastructure
↓
MonCash
```

---

## Codes d’erreurs Authentication

| Code                  | Description    |
| --------------------- | -------------- |
| unauthorized          | Clé invalide   |
| invalid_api_key       | Mauvais format |
| expired_api_key       | Clé expirée    |
| revoked_api_key       | Clé désactivée |
| missing_authorization | Header absent  |

---

## Exemple réponse erreur

```json id="dkt1ao"
{
  "success": false,
  "error": {
    "code": "unauthorized",
    "message": "Invalid API key"
  }
}
```

---


