# Errors API

L’API Kobara utilise les codes HTTP standards pour communiquer le résultat d’une requête.

Les réponses sont toujours structurées afin de permettre :

* un debugging rapide ;
* une gestion fiable des erreurs ;
* une meilleure expérience utilisateur ;
* une intégration robuste côté backend.

---

## Structure générale des erreurs

Lorsqu’une erreur survient, Kobara retourne :

* un code HTTP ;
* un objet `error` ;
* un message lisible ;
* un type d’erreur ;
* parfois le paramètre concerné.

---

## Format de réponse erreur

```json id="kobara-error-format"
{
  "error": {
    "type": "invalid_request_error",
    "code": "parameter_missing",
    "message": "Le champ 'amount' est requis.",
    "param": "amount"
  }
}
```

---

## Champs de l’objet error

| Champ   | Description            |
| ------- | ---------------------- |
| type    | catégorie de l’erreur  |
| code    | code technique interne |
| message | message lisible        |
| param   | champ concerné         |

---

## Codes HTTP supportés

## 200 / 201 — Success

La requête a réussi.

Exemples :

* paiement créé ;
* lien généré ;
* webhook enregistré ;
* retrait accepté.

---

## Exemple

```json id="success-response"
{
  "id": "pay_92a8f",
  "status": "pending"
}
```

---

## 400 — Bad Request

La requête est invalide.

Causes fréquentes :

* champ manquant ;
* montant invalide ;
* mauvais format JSON ;
* devise invalide ;
* payload vide.

---

## Exemple

```json id="bad-request"
{
  "error": {
    "type": "invalid_request_error",
    "code": "parameter_missing",
    "message": "Le champ 'amount' est requis.",
    "param": "amount"
  }
}
```

---

## 401 — Unauthorized

La requête n’est pas authentifiée.

Causes fréquentes :

* Secret Key absente ;
* clé invalide ;
* clé révoquée ;
* mauvais Bearer token.

---

## Exemple

```json id="unauthorized-response"
{
  "error": {
    "type": "authentication_error",
    "code": "invalid_api_key",
    "message": "La clé API fournie est invalide."
  }
}
```

---

## 403 — Forbidden

La clé API ne possède pas les permissions nécessaires.

Causes fréquentes :

* utilisation d’une clé publique côté serveur ;
* tentative de retrait avec clé publique ;
* permissions insuffisantes ;
* environnement incorrect.

---

## Exemple

```json id="forbidden-response"
{
  "error": {
    "type": "permission_error",
    "code": "forbidden",
    "message": "Cette action nécessite une Secret Key."
  }
}
```

---

## 404 — Not Found

La ressource demandée n’existe pas.

Causes fréquentes :

* payment introuvable ;
* payment_link supprimé ;
* webhook inexistant ;
* mauvais ID.

---

## Exemple

```json id="not-found-response"
{
  "error": {
    "type": "invalid_request_error",
    "code": "resource_missing",
    "message": "Le paiement demandé est introuvable."
  }
}
```

---

## 409 — Conflict

Conflit lié à l’idempotence ou à l’état de la ressource.

Causes fréquentes :

* même Idempotency-Key réutilisée ;
* double création ;
* conflit de traitement.

---

## Exemple

```json id="conflict-response"
{
  "error": {
    "type": "idempotency_error",
    "code": "key_already_used",
    "message": "Cette clé d'idempotence a déjà été utilisée."
  }
}
```

---

## 429 — Too Many Requests

La limite de requêtes API a été dépassée.

Kobara applique un rate limit pour :

* protéger l’infrastructure ;
* éviter les abus ;
* garantir la stabilité.

---

## Bonnes pratiques

✅ utiliser retry avec backoff
✅ limiter les boucles API
✅ utiliser cache local
✅ utiliser webhooks plutôt que polling

---

## Exemple

```json id="rate-limit-response"
{
  "error": {
    "type": "rate_limit_error",
    "code": "too_many_requests",
    "message": "Trop de requêtes envoyées."
  }
}
```

---

## 500+ — Server Error

Erreur interne inattendue.

Causes possibles :

* erreur serveur ;
* timeout ;
* service temporairement indisponible ;
* erreur infrastructure.

---

## Exemple

```json id="server-error-response"
{
  "error": {
    "type": "api_error",
    "code": "internal_error",
    "message": "Une erreur interne est survenue."
  }
}
```

---

## Types d’erreurs

| Type                  | Description               |
| --------------------- | ------------------------- |
| invalid_request_error | requête invalide          |
| authentication_error  | problème authentification |
| permission_error      | permissions insuffisantes |
| rate_limit_error      | limite dépassée           |
| api_error             | erreur interne            |
| idempotency_error     | conflit idempotence       |

---

## Gestion recommandée côté backend

### Toujours faire

✅ logger les erreurs
✅ logger les request_id
✅ afficher un message utilisateur propre
✅ utiliser try/catch
✅ gérer les retries intelligemment

---

## Exemple Node.js

```js id="node-error-handling"
try {
  const payment = await kobara.payments.create({
    amount: 1000
  });

} catch (error) {

  console.error(error);

  if (error.code === "parameter_missing") {
    return res.status(400).json({
      message: "Montant requis"
    });
  }

  return res.status(500).json({
    message: "Erreur interne"
  });
}
```

---

## Exemple Frontend

```js id="frontend-error-example"
if (response.error) {
  showToast(response.error.message);
}
```

---

## Gestion des retries

Certaines erreurs peuvent être retentées automatiquement :

| Code | Retry recommandé |
| ---- | ---------------- |
| 429  | oui              |
| 500  | oui              |
| 503  | oui              |
| 400  | non              |
| 401  | non              |

---

## Retry exponentiel recommandé

```txt id="retry-strategy"
1ère tentative : 1 seconde
2ème tentative : 2 secondes
3ème tentative : 4 secondes
4ème tentative : 8 secondes
```

---

## Sécurité

Ne jamais :

* exposer les détails internes serveur ;
* afficher les stack traces ;
* afficher les Secret Keys ;
* retourner les erreurs SQL brutes.

---

## Bonnes pratiques UX

## Recommandé

✅ messages utilisateur simples
✅ logs détaillés côté serveur
✅ retry automatique discret
✅ états loading/error clairs

---

## Exemple UX

❌ Mauvais :

```txt id="bad-ux"
SQLSTATE[42P01]: relation payments does not exist
```

✅ Bon :

```txt id="good-ux"
Une erreur est survenue lors du paiement. Réessayez dans quelques instants.
```

---

## Corrélation & Debugging

Chaque requête Kobara peut retourner un identifiant interne :

```http id="request-id"
Kobara-Request-Id: req_82hd7s9sh
```

Conservez cet ID dans vos logs pour faciliter :

* le debugging ;
* le support ;
* les audits techniques.

---
