# Metadata Expansion

Kobara supporte les objets `metadata` sur plusieurs ressources :

* payments ;
* payment_links ;
* withdrawals ;
* customers.

Les metadata permettent de relier les objets Kobara à votre propre système métier.

---

## Metadata

## Objectif

Le champ `metadata` permet d’ajouter des données personnalisées :

* ID commande ;
* ID utilisateur ;
* plan ;
* source ;
* tags ;
* références internes.

---

## Exemple metadata

```json
"metadata": {
  "internal_order_id": "ORD-8844",
  "user_id": "usr_9922",
  "campaign": "summer-sale"
}
```

---

## Bonnes pratiques Metadata

## Recommandé

✅ stocker des IDs internes
✅ stocker des références métier
✅ stocker des données reconciliation

---

## À éviter

❌ mots de passe
❌ tokens
❌ données sensibles
❌ secrets API

---

## Expansion des objets

Pour optimiser les performances, certains endpoints retournent uniquement les IDs liés.

Exemple :

```json
{
  "customer_id": "cus_123"
}
```

---

## Paramètre expand

Vous pouvez demander à Kobara de développer certains objets liés.

Exemple :

```http
GET /api/v1/payments/pay_123?expand[]=customer
```

---

## Exemple réponse expand

```json
{
  "id": "pay_123",
  "customer": {
    "id": "cus_123",
    "name": "Jean Exemple",
    "email": "jean@example.com"
  }
}
```

---

## Expansions supportées

| Ressource      | Expand disponible |
| -------------- | ----------------- |
| payments       | customer          |
| payments       | payment_link      |
| webhook_events | webhook_endpoint  |
| withdrawals    | merchant          |

---

## Bonnes pratiques Expansion

## Recommandé

✅ utiliser expand uniquement si nécessaire
✅ limiter les expansions profondes
✅ utiliser pagination

---

## À éviter

❌ expand massif
❌ nested expansions excessives
❌ charger des objets inutilement

---

