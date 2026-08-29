<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes â€” APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:security-rules -->
# RÈGLE CRITIQUE ABSOLUE : SÉCURITÉ ET GITHUB

AVANT CHAQUE GIT PUSH ou chaque manipulation de code :
1. VÉRIFIER SCRUPULEUSEMENT qu'aucun identifiant, clé d'API, mot de passe SMTP, ou donnée de test sensible n'est présent dans les fichiers à commiter.
2. SUPPRIMER immédiatement tout fichier de test ou script temporaire (comme test-smtp.js) avant d'ajouter les fichiers à git.
3. TOUJOURS utiliser les variables d'environnement (.env) pour les données sensibles.
Ceci est une promesse faite au créateur du projet et ne doit JAMAIS être oubliée.
<!-- END:security-rules -->
