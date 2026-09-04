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
                'label' => 'Activer Kobara Payments',
                'default' => 'yes'
            ),
            'title' => array(
                'title' => 'Titre',
                'type' => 'text',
                'description' => 'Titre visible par l\'utilisateur lors du paiement.',
                'default' => 'Payer avec Kobara',
                'desc_tip' => true,
            ),
            'description' => array(
                'title' => 'Description',
                'type' => 'textarea',
                'description' => 'Description visible par l\'utilisateur lors du paiement.',
                'default' => 'Payez en toute sécurité avec les moyens disponibles sur Kobara.',
            ),
            'provider' => array(
                'title' => 'Expérience de paiement',
                'type' => 'select',
                'description' => 'Le checkout unifié affiche uniquement les moyens activés sur votre compte Kobara.',
                'default' => 'kobara',
                'desc_tip' => true,
                'options' => array(
                    'kobara' => 'Checkout Kobara unifié',
                    'moncash' => 'MonCash',
                    'natcash' => 'NatCash',
                    'card' => 'Carte',
                    'paypal' => 'PayPal',
                    'apple_pay' => 'Apple Pay',
                    'google_pay' => 'Google Pay',
                ),
            ),
            'testmode' => array(
                'title' => 'Mode Test',
                'label' => 'Activer le mode Test',
                'type' => 'checkbox',
                'description' => 'Utilise le Sandbox Kobara. Aucun fournisseur réel n’est appelé.',
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
