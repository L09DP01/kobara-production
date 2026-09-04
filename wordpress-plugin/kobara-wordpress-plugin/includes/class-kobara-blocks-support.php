<?php
use Automattic\WooCommerce\Blocks\Payments\Integrations\AbstractPaymentMethodType;

if (!defined('ABSPATH')) {
    exit;
}

final class Kobara_Blocks_Support extends AbstractPaymentMethodType {
    protected $name = 'kobara';

    public function initialize() {
        $this->settings = get_option('woocommerce_kobara_settings', array());
    }

    public function is_active() {
        if (!isset($this->settings['enabled']) || $this->settings['enabled'] !== 'yes') {
            return false;
        }

        $is_test = isset($this->settings['testmode']) && $this->settings['testmode'] === 'yes';
        $key_name = $is_test ? 'test_secret_key' : 'live_secret_key';

        return !empty($this->settings[$key_name]);
    }

    public function get_payment_method_script_handles() {
        wp_register_script(
            'kobara-woocommerce-blocks',
            KOBARA_PLUGIN_URL . 'assets/js/blocks.js',
            array('wc-blocks-registry', 'wc-settings', 'wp-element', 'wp-html-entities'),
            KOBARA_PLUGIN_VERSION,
            true
        );

        return array('kobara-woocommerce-blocks');
    }

    public function get_payment_method_data() {
        return array(
            'title' => $this->settings['title'] ?? __('Pay with Kobara', 'kobara-payments-for-woocommerce'),
            'description' => $this->settings['description'] ?? '',
            'icon' => KOBARA_PLUGIN_URL . 'assets/kobara-icon.png',
            'supports' => array('products'),
        );
    }
}
