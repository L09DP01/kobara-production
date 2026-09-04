<?php
if (!defined('ABSPATH')) {
    exit;
}

class Kobara_API_Client {
    private $secret_key;
    private $base_url;

    public function __construct($secret_key, $is_test_mode = false) {
        $this->secret_key = trim((string) $secret_key);
        $this->base_url = $is_test_mode ? KOBARA_API_TEST_BASE_URL : KOBARA_API_LIVE_BASE_URL;
    }

    public function create_payment($order_id, $amount, $currency, $provider, $customer, $success_url, $error_url) {
        if (empty($this->secret_key)) {
            return array('success' => false, 'message' => __('The Kobara secret key is missing.', 'kobara-payments-for-woocommerce'));
        }

        $allowed_providers = array('kobara', 'moncash', 'natcash', 'card', 'paypal', 'apple_pay', 'google_pay');
        $provider = strtolower(trim((string) $provider));
        if (!in_array($provider, $allowed_providers, true)) {
            $provider = 'kobara';
        }

        $endpoint = $this->base_url . '/payments';

        $body = array(
            'amount' => (float) $amount,
            'currency' => strtoupper((string) $currency),
            'provider' => $provider,
            'description' => 'Commande #' . $order_id,
            'metadata' => array(
                'order_id' => $order_id,
                'source' => 'woocommerce'
            ),
            'customer' => array_filter($customer),
            'success_url' => $success_url,
            'cancel_url' => $error_url
        );

        $idempotency_key = 'wc_' . $order_id . '_' . substr(hash('sha256', wp_json_encode($body)), 0, 32);

        $response = wp_remote_post($endpoint, array(
            'headers' => array(
                'Authorization' => 'Bearer ' . $this->secret_key,
                'Content-Type' => 'application/json',
                'Idempotency-Key' => $idempotency_key
            ),
            'body' => wp_json_encode($body),
            'timeout' => 30,
            'redirection' => 0,
            'sslverify' => true,
            'user-agent' => 'Kobara-WooCommerce/' . KOBARA_PLUGIN_VERSION,
            'data_format' => 'body',
        ));

        if (is_wp_error($response)) {
            return array('success' => false, 'message' => $response->get_error_message());
        }

        $response_code = wp_remote_retrieve_response_code($response);
        $response_body = wp_remote_retrieve_body($response);
        $data = json_decode($response_body, true);
        if (!is_array($data)) {
            return array('success' => false, 'message' => __('Kobara returned an invalid response.', 'kobara-payments-for-woocommerce'));
        }

        $payment_url = $data['data']['checkout_url'] ?? $data['data']['url'] ?? null;

        if ($response_code >= 200 && $response_code < 300 && $payment_url) {
            return array(
                'success' => true,
                'url' => esc_url_raw($payment_url),
                'payment_id' => isset($data['data']['id']) ? sanitize_text_field($data['data']['id']) : '',
            );
        }

        $message = $data['message'] ?? $data['error'] ?? __('Kobara could not create the payment.', 'kobara-payments-for-woocommerce');
        if (!is_string($message)) {
            $message = wp_json_encode($message);
        }

        return array('success' => false, 'message' => sanitize_text_field($message));
    }
}
