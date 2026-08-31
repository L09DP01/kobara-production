import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BUSINESS_NAME_TAKEN_MESSAGE,
  getBusinessNameValidationError,
  isBusinessNameConflict,
  normalizeBusinessName,
} from '../src/lib/business-name.ts';

test('business names are normalized without changing their display case', () => {
  assert.equal(normalizeBusinessName('  Kobara   Services  '), 'Kobara Services');
  assert.equal(normalizeBusinessName(null), '');
});

test('business names are required, have length limits, and accept valid letter-only names', () => {
  assert.equal(getBusinessNameValidationError('   '), "Le nom de l'entreprise est obligatoire.");
  assert.equal(getBusinessNameValidationError('A'), "Le nom de l'entreprise doit comporter au moins 2 caractères.");
  assert.equal(getBusinessNameValidationError('A'.repeat(256)), "Le nom de l'entreprise ne peut pas dépasser 255 caractères.");
  assert.equal(getBusinessNameValidationError('Kobara Services'), null);
  assert.equal(getBusinessNameValidationError('Boutique Élégance Créole'), null);
  assert.equal(getBusinessNameValidationError('Entreprise Haïtienne'), null);
});

test('business names reject numbers and digits', () => {
  assert.equal(
    getBusinessNameValidationError('Kobara 123'),
    "Les chiffres et numéros ne sont pas autorisés dans le nom de l'entreprise."
  );
  assert.equal(
    getBusinessNameValidationError('Shop 2026'),
    "Les chiffres et numéros ne sont pas autorisés dans le nom de l'entreprise."
  );
  assert.equal(
    getBusinessNameValidationError('7 Boutique'),
    "Les chiffres et numéros ne sont pas autorisés dans le nom de l'entreprise."
  );
});

test('business names reject links, URLs and web domains', () => {
  assert.equal(
    getBusinessNameValidationError('https://kobara.app'),
    "Les liens ou adresses web ne sont pas autorisés dans le nom de l'entreprise."
  );
  assert.equal(
    getBusinessNameValidationError('http://shop.ht'),
    "Les liens ou adresses web ne sont pas autorisés dans le nom de l'entreprise."
  );
  assert.equal(
    getBusinessNameValidationError('www.boutique.com'),
    "Les liens ou adresses web ne sont pas autorisés dans le nom de l'entreprise."
  );
  assert.equal(
    getBusinessNameValidationError('MonSite.com'),
    "Les liens ou adresses web ne sont pas autorisés dans le nom de l'entreprise."
  );
  assert.equal(
    getBusinessNameValidationError('boutique.com/service'),
    "Les liens ou adresses web ne sont pas autorisés dans le nom de l'entreprise."
  );
});

test('business names reject special characters and symbols', () => {
  assert.equal(
    getBusinessNameValidationError('Acme & Co'),
    "Les caractères spéciaux ne sont pas autorisés dans le nom de l'entreprise (seules les lettres et les espaces sont acceptés)."
  );
  assert.equal(
    getBusinessNameValidationError('Shop@Home'),
    "Les caractères spéciaux ne sont pas autorisés dans le nom de l'entreprise (seules les lettres et les espaces sont acceptés)."
  );
  assert.equal(
    getBusinessNameValidationError('Super_Store'),
    "Les caractères spéciaux ne sont pas autorisés dans le nom de l'entreprise (seules les lettres et les espaces sont acceptés)."
  );
  assert.equal(
    getBusinessNameValidationError('Kobara!'),
    "Les caractères spéciaux ne sont pas autorisés dans le nom de l'entreprise (seules les lettres et les espaces sont acceptés)."
  );
  assert.equal(
    getBusinessNameValidationError('Acme-Corp'),
    "Les caractères spéciaux ne sont pas autorisés dans le nom de l'entreprise (seules les lettres et les espaces sont acceptés)."
  );
  assert.equal(
    getBusinessNameValidationError('Boutique #1'),
    "Les chiffres et numéros ne sont pas autorisés dans le nom de l'entreprise."
  );
});

test('business names reject placeholders and generic-only labels', () => {
  assert.match(getBusinessNameValidationError('Testing'), /nom réel/);
  assert.match(getBusinessNameValidationError('Test Boutique'), /nom réel/);
  assert.match(getBusinessNameValidationError('Demo Company'), /nom réel/);
  assert.match(getBusinessNameValidationError('Boutique'), /distinctif/);
  assert.match(getBusinessNameValidationError('Entreprise Services'), /distinctif/);
  assert.equal(getBusinessNameValidationError('Boutique Élégance'), null);
  assert.equal(getBusinessNameValidationError('Kobara'), null);
});

test('only the dedicated database uniqueness error is mapped as a name conflict', () => {
  assert.equal(isBusinessNameConflict({ code: '23505', message: 'business_name_already_exists' }), true);
  assert.equal(isBusinessNameConflict({ code: '23505', message: 'duplicate business_slug' }), false);
  assert.equal(isBusinessNameConflict({ code: '22001', message: 'business_name_already_exists' }), false);
  assert.match(BUSINESS_NAME_TAKEN_MESSAGE, /déjà utilisé/);
});
