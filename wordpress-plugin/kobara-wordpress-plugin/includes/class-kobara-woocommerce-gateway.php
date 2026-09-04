<?php
if (!defined('ABSPATH')) {
    exit;
}

class Kobara_WC_Gateway extends WC_Payment_Gateway {
    public $testmode;
    public $provider;

    private $test_secret_key;
    private $live_secret_key;
    private $secret_key;

    public function __construct() {
        $this->id = 'kobara';
        $this->icon = KOBARA_PLUGIN_URL . 'assets/kobara-icon.png';
        $this->has_fields = false;
        $this->method_title = 'Kobara Payments';
        $this->method_description = '<img src="' . esc_url($this->icon) . '" width="40" height="40" alt="Kobara" style="float:left;margin:0 12px 8px 0;border-radius:8px" />' . esc_html__('Accept the local and international payment methods enabled on your Kobara account.', 'kobara-payments-for-woocommerce');
        $this->supports = array('products');

        $this->init_form_fields();
        $this->init_settings();

        $this->title = $this->get_option('title');
        $this->description = $this->get_option('description');
        $this->testmode = 'yes' === $this->get_option('testmode');
        $this->provider = $this->get_option('provider', 'kobara');
        
        $this->test_secret_key = $this->get_option('test_secret_key');
        $this->live_secret_key = $this->get_option('live_secret_key');
        $this->secret_key = $this->testmode ? $this->test_secret_key : $this->live_secret_key;

        add_action('woocommerce_update_options_payment_gateways_' . $this->id, array($this, 'process_admin_options'));

    }

    public function init_form_fields() {
        $this->form_fields = Kobara_Settings::get_form_fields();
    }

    public function process_payment($order_id) {
        $order = wc_get_order($order_id);
        if (!$order) {
            wc_add_notice(__('Unable to load this order.', 'kobara-payments-for-woocommerce'), 'error');
            return null;
        }

        $client = new Kobara_API_Client($this->secret_key, $this->testmode);

        $amount = round((float) $order->get_total(), wc_get_price_decimals());

        $customer = array(
            'name' => trim($order->get_billing_first_name() . ' ' . $order->get_billing_last_name()),
            'email' => $order->get_billing_email(),
            'phone' => $order->get_billing_phone(),
        );
        
        $success_url = $this->get_return_url($order);
        $error_url = wc_get_checkout_url();

        $result = $client->create_payment(
            $order_id,
            $amount,
            $order->get_currency(),
            $this->provider,
            $customer,
            $success_url,
            $error_url
        );

        if ($result['success']) {
            $order->update_meta_data('_kobara_payment_id', $result['payment_id']);
            $order->update_meta_data('_kobara_environment', $this->testmode ? 'test' : 'live');
            $order->save();

            return array(
                'result' => 'success',
                'redirect' => $result['url']
            );
        } else {
            wc_add_notice(
                sprintf(__('Payment error: %s', 'kobara-payments-for-woocommerce'), esc_html($result['message'])),
                'error'
            );
            return null;
        }
    }

    public function is_available() {
        if (!parent::is_available()) {
            return false;
        }

        if (!in_array(get_woocommerce_currency(), array('HTG', 'USD'), true)) {
            return false;
        }

        return !empty($this->secret_key);
    }
}
