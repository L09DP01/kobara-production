<?php
if (!defined('ABSPATH')) {
    exit;
}

class Kobara_WC_Gateway extends WC_Payment_Gateway {
    public function __construct() {
        $this->id = 'kobara';
        $this->icon = 'kobara-wordpress-plugin/moncashicon.png'; // URL vers l'icône MonCash/Kobara
        $this->has_fields = false;
        $this->method_title = 'Kobara (MonCash)';
        $this->method_description = 'Acceptez les paiements MonCash via Kobara.';

        $this->init_form_fields();
        $this->init_settings();

        $this->title = $this->get_option('title');
        $this->description = $this->get_option('description');
        $this->testmode = 'yes' === $this->get_option('testmode');
        
        $this->test_secret_key = $this->get_option('test_secret_key');
        $this->live_secret_key = $this->get_option('live_secret_key');
        $this->webhook_secret = $this->get_option('webhook_secret');

        $this->secret_key = $this->testmode ? $this->test_secret_key : $this->live_secret_key;

        add_action('woocommerce_update_options_payment_gateways_' . $this->id, array($this, 'process_admin_options'));

        if (!empty($this->webhook_secret)) {
            new Kobara_Webhook($this->webhook_secret);
        }
    }

    public function init_form_fields() {
        $this->form_fields = Kobara_Settings::get_form_fields();
    }

    public function process_payment($order_id) {
        $order = wc_get_order($order_id);
        
        $client = new Kobara_API_Client($this->secret_key, $this->testmode);
        
        $amount = intval(round($order->get_total() * 100)); // En centimes ou unités selon devise
        // Si HTG, adapter si Kobara attend des centimes ou la valeur nominale. On suppose valeur nominale.
        if ($order->get_currency() === 'HTG') {
            $amount = intval(round($order->get_total()));
        }

        $customer_name = $order->get_billing_first_name() . ' ' . $order->get_billing_last_name();
        $customer_phone = $order->get_billing_phone();
        
        $success_url = $this->get_return_url($order);
        $error_url = wc_get_checkout_url();

        $result = $client->create_payment(
            $order_id,
            $amount,
            $order->get_currency(),
            $customer_name,
            $customer_phone,
            $success_url,
            $error_url
        );

        if ($result['success']) {
            return array(
                'result' => 'success',
                'redirect' => $result['url']
            );
        } else {
            wc_add_notice('Erreur de paiement : ' . $result['message'], 'error');
            return;
        }
    }
}
