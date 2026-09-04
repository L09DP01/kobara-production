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

        $signature = $this->parse_signature($signature_header);
        if (!$signature || abs(time() - $signature['timestamp']) > 300) {
            status_header(401);
            exit('Invalid Signature');
        }

        $expected_signature = hash_hmac(
            'sha256',
            $signature['timestamp'] . '.' . $payload,
            $this->webhook_secret
        );

        if (!hash_equals(strtolower($expected_signature), strtolower($signature['value']))) {
            status_header(401);
            exit('Invalid Signature');
        }

        $event = json_decode($payload, true);

        if (!$event || !isset($event['event_type'], $event['data']) || !is_array($event['data'])) {
            status_header(400);
            exit('Invalid Payload');
        }

        $delivery_key = 'kobara_webhook_' . hash('sha256', $signature_header . '.' . $payload);
        if (get_transient($delivery_key)) {
            status_header(200);
            exit('OK');
        }
        set_transient($delivery_key, '1', 10 * MINUTE_IN_SECONDS);

        $event_type = sanitize_text_field($event['event_type']);
        if (in_array($event_type, array('payment.succeeded', 'payment.failed'), true)) {
            $order_id = isset($event['data']['metadata']['order_id']) ? intval($event['data']['metadata']['order_id']) : 0;

            if ($order_id) {
                $order = wc_get_order($order_id);
                $payment_id = isset($event['data']['id']) ? sanitize_text_field($event['data']['id']) : '';
                $event_environment = isset($event['environment']) ? sanitize_text_field($event['environment']) : '';
                $order_environment = $order ? $order->get_meta('_kobara_environment') : '';
                $order_payment_id = $order ? $order->get_meta('_kobara_payment_id') : '';

                if (
                    !$order
                    || ($order_environment && $event_environment !== $order_environment)
                    || ($order_payment_id && $payment_id !== $order_payment_id)
                ) {
                    status_header(200);
                    exit('OK');
                }

                if ($event_type === 'payment.succeeded' && $order->needs_payment()) {
                    $order->payment_complete($payment_id);
                    $order->add_order_note(sprintf('Paiement Kobara confirme. Transaction ID: %s', $payment_id));
                } elseif ($event_type === 'payment.failed' && $order->needs_payment()) {
                    $order->update_status('failed', __('Kobara reported that the payment failed.', 'kobara-payments-for-woocommerce'));
                }
            }
        }

        status_header(200);
        exit('OK');
    }

    private function parse_signature($header) {
        $timestamp = 0;
        $signature = '';

        foreach (explode(',', $header) as $part) {
            $pair = array_map('trim', explode('=', $part, 2));
            if (count($pair) !== 2) {
                continue;
            }
            if ($pair[0] === 't' && ctype_digit($pair[1])) {
                $timestamp = (int) $pair[1];
            }
            if ($pair[0] === 'v1' && preg_match('/^[a-f0-9]{64}$/i', $pair[1])) {
                $signature = $pair[1];
            }
        }

        return $timestamp > 0 && $signature ? array('timestamp' => $timestamp, 'value' => $signature) : null;
    }
}
