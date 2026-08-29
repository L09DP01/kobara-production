import { docsLinks } from "./docs-links";

export const kobaraSdks = [
  {
    id: "javascript",
    icon: "javascript",
    version: "v1.0.0",
    name: "JavaScript SDK",
    usage: "Pour les applications frontend",
    installCommand: "npm install kobara-js",
    docsUrl: docsLinks.javascriptSdk
  },
  {
    id: "nodejs",
    icon: "data_object",
    version: "v1.0.0",
    name: "Node.js SDK",
    usage: "Pour les serveurs Node.js",
    installCommand: "npm install @kobara/node",
    docsUrl: docsLinks.nodeSdk
  },
  {
    id: "python",
    icon: "terminal",
    version: "v1.0.0",
    name: "Python SDK",
    usage: "Pour Django, Flask, FastAPI",
    installCommand: "pip install kobara",
    docsUrl: docsLinks.pythonSdk
  },
  {
    id: "php",
    icon: "code",
    version: "v1.0.0",
    name: "PHP SDK",
    usage: "Pour Laravel, Symfony",
    installCommand: "composer require kobara/php-sdk",
    docsUrl: docsLinks.phpSdk
  }
];
