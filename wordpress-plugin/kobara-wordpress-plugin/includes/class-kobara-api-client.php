<?php
if (!defined('ABSPATH')) {
    exit;
}

class Kobara_API_Client {
    private $secret_key;
    private $is_test_mode;

    public function __construct($secret_key, $is_test_mode = false) {
        $this->secret_key = $secret_key;
        $this->is_test_mode = $is_test_mode;
    }

    public function create_payment($order_id, $amount, $currency, $customer_name, $customer_phone, $success_url, $error_url) {
        $endpoint = KOBARA_API_BASE_URL . '/payments';

        $body = array(
            'amount' => $amount,
            'currency' => $currency,
            'description' => 'Commande #' . $order_id,
            'metadata' => array(
                'order_id' => $order_id,
                'source' => 'woocommerce'
            ),
            'customer' => array(
                'name' => $customer_name,
                'phone' => $customer_phone
            ),
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
            'timeout' => 30
        ));

        if (is_wp_error($response)) {
            return array('success' => false, 'message' => $response->get_error_message());
        }

        $response_code = wp_remote_retrieve_response_code($response);
        $response_body = wp_remote_retrieve_body($response);
        $data = json_decode($response_body, true);

        $payment_url = $data['data']['checkout_url'] ?? $data['data']['url'] ?? null;

        if ($response_code >= 200 && $response_code < 300 && $payment_url) {
            return array('success' => true, 'url' => $payment_url, 'payment_id' => $data['data']['id']);
        }

        $message = $data['message'] ?? $data['error'] ?? 'Réponse invalide de l\'API Kobara';
        if (!is_string($message)) {
            $message = wp_json_encode($message);
        }

        return array('success' => false, 'message' => $message);
    }
}
