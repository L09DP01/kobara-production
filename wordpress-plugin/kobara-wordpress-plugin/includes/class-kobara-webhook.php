<?php
if (!defined('ABSPATH')) {
    exit;
}

class Kobara_Webhook {
    private $webhook_secret;

    public function __construct($webhook_secret) {
        $this->webhook_secret = $webhook_secret;
        add_action('woocommerce_api_kobara_webhook', array($this, 'handle_webhook'));
    }

    public function handle_webhook() {
        $payload = file_get_contents('php://input');
        $signature_header = isset($_SERVER['HTTP_KOBARA_SIGNATURE']) ? sanitize_text_field(wp_unslash($_SERVER['HTTP_KOBARA_SIGNATURE'])) : '';

        if (empty($signature_header) || empty($payload)) {
            status_header(400);
            exit('Invalid Request');
        }

        $expected_signature = hash_hmac('sha256', $payload, $this->webhook_secret);

        if (!hash_equals($expected_signature, $signature_header)) {
            status_header(401);
            exit('Invalid Signature');
        }

        $event = json_decode($payload, true);

        if (!$event || !isset($event['type'])) {
            status_header(400);
            exit('Invalid Payload');
        }

        if ($event['type'] === 'payment.succeeded') {
            $order_id = isset($event['data']['metadata']['order_id']) ? intval($event['data']['metadata']['order_id']) : 0;
            
            if ($order_id) {
                $order = wc_get_order($order_id);
                if ($order && $order->needs_payment()) {
                    $order->payment_complete($event['data']['id']);
                    $order->add_order_note('Paiement Kobara réussi. Transaction ID: ' . $event['data']['id']);
                }
            }
        }

        status_header(200);
        exit('OK');
    }
}
