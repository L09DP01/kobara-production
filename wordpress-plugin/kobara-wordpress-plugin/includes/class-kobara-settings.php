<?php
if (!defined('ABSPATH')) {
    exit;
}

class Kobara_Settings {
    public static function get_form_fields() {
        return array(
            'enabled' => array(
                'title' => 'Activer/Désactiver',
                'type' => 'checkbox',
                'label' => 'Activer le paiement Kobara (MonCash)',
                'default' => 'yes'
            ),
            'title' => array(
                'title' => 'Titre',
                'type' => 'text',
                'description' => 'Titre visible par l\'utilisateur lors du paiement.',
                'default' => 'Payer avec MonCash',
                'desc_tip' => true,
            ),
            'description' => array(
                'title' => 'Description',
                'type' => 'textarea',
                'description' => 'Description visible par l\'utilisateur lors du paiement.',
                'default' => 'Payez en toute sécurité via MonCash avec Kobara.',
            ),
            'testmode' => array(
                'title' => 'Mode Test',
                'label' => 'Activer le mode Test',
                'type' => 'checkbox',
                'description' => 'Utilisez les clés de test pour simuler des paiements.',
                'default' => 'yes',
                'desc_tip' => true,
            ),
            'test_secret_key' => array(
                'title' => 'Clé Secrète (Test)',
                'type' => 'password',
            ),
            'live_secret_key' => array(
                'title' => 'Clé Secrète (Live)',
                'type' => 'password',
            ),
            'webhook_secret' => array(
                'title' => 'Secret Webhook',
                'type' => 'password',
                'description' => 'Nécessaire pour vérifier les notifications de paiement.',
            )
        );
    }
}
