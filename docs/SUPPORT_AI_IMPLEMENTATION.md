# Premiere assistance Kobara et details des retraits

## Support

La premiere reponse automatique est branchee dans createSupportConversation,
apres la creation reussie du ticket et du message client. after() lance le
traitement sans retarder la confirmation de reception.

- Recherche dans l'index existant de documentation, aide et pages publiques.
- Lecture HTTP des pages candidates : domaines/routes Kobara publics uniquement.
- Extraction HTML avec htmlparser2, incluant les fragments SSR React S:*.
- Aucun acces arbitraire au dashboard, aux URL fournies par le client ou au reseau interne.
- Reponse fondee sur le contenu lu, courte, naturelle, dans la langue du client.
- En cas d'incertitude, d'echec ou de demande humaine, confirmation polie du
  ticket deja enregistre ; statut pending_admin et alerte de l'equipe technique.
- Une seule premiere reponse par ticket. La RPC recontrole les reponses humaines,
  l'assignation, la fermeture et les doublons sous verrou transactionnel.
- Les tickets de transfert WhatsApp sont exclus : ne pas relancer l'IA apres un transfert humain.
- Les references et l'origine automatisee sont visibles dans le systeme core.
- Aucune information de compte n'est envoyee au modele sur la simple base d'un email public.
- Tous les secrets detectables sont masques, y compris plusieurs occurrences.
- Un message contenant une cle declenche une instruction de revocation, sans recopier la cle.

La premiere reponse est envoyee par email. Les messages suivants d'un meme
ticket restent pour le support humain ; ce n'est pas un chatbot autonome continu.

## Activation

1. Confirmer le projet Supabase de production.
2. Appliquer 20261013230214_support_assistant_first_reply.sql avant le code.
3. Configurer GEMINI_API_KEY ou GOOGLE_GENERATIVE_AI_API_KEY dans l'environnement
   serveur, sans jamais partager la valeur dans une conversation ou dans Git.
4. SUPPORT_AI_ENABLED=true ; SUPPORT_AI_MODEL=gemini-2.5-flash ;
   SUPPORT_AI_ALERT_EMAIL doit etre une adresse de l'equipe.
5. Verifier la configuration Resend et une reception/reponse complete.

La migration a ete testee puis annulee sur le nouveau projet : aucune migration
persistante n'a ete appliquee, aucun email client de test n'a ete envoye.

## Retraits du systeme core

Un bouton CircleAlert (!) apparait pres de la reference des retraits failed.
Il ouvre une fenetre accessible, compatible mobile et fermable avec Echap.
Elle affiche le motif exploitable, le code HTTP et le code fournisseur quand
ils existent, et une confirmation de recredit uniquement si refunded_at est present.

Le serveur retire provider_response des proprietes envoyees au navigateur et
ne conserve que les champs de diagnostic sanitises. Aucun transfert, validation,
rejet ou remboursement n'est declenche par l'ouverture de cette fenetre.

## Verification

- 72 tests cibles reussis (support, limites, abonnements, retraits et erreurs).
- Premiere reponse reelle du modele verifiee sur une question publique de webhook.
- Lecture reelle des pages help/payment-status et docs/webhooks verifiee.
- SQL : doublon, ticket ferme, message humain, WhatsApp et permissions testes
  sur des fixtures temporaires, puis rollback integral.
- Fenetre de retrait verifiee avec Playwright sur desktop et mobile, donnees fictives.
- L'installation des dependances signale 29 vulnerabilites dans l'arbre npm.
  Leur analyse/remediation n'a pas ete effectuee dans cette modification ; aucun audit fix --force applique.
