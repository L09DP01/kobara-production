<?php
/**
 * Plugin Name: Kobara Payments for WooCommerce
 * Plugin URI: https://docs.kobara.app/docs/wordpress-plugin
 * Description: Accept local and international payment methods enabled on your Kobara account in WooCommerce.
 * Version: 2.0.0
 * Requires at least: 6.0
 * Requires PHP: 7.4
 * Author: Kobara
 * Author URI: https://kobara.app
 * License: GPL-2.0-or-later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: kobara-payments-for-woocommerce
 * Requires Plugins: woocommerce
 * WC requires at least: 7.0
 * WC tested up to: 9.0
 */

if (!defined('ABSPATH')) {
    exit;
}

// Declare WooCommerce HPOS compatibility
add_action('before_woocommerce_init', function() {
    if (class_exists(\Automattic\WooCommerce\Utilities\FeaturesUtil::class)) {
        \Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility(
            'custom_order_tables',
            __FILE__,
            true
        );
    }
});

// Define plugin constants
define('KOBARA_PLUGIN_VERSION', '2.0.0');
define('KOBARA_PLUGIN_FILE', __FILE__);
define('KOBARA_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('KOBARA_PLUGIN_URL', plugin_dir_url(__FILE__));
define('KOBARA_API_LIVE_BASE_URL', 'https://api.kobara.app/v1');
define('KOBARA_API_TEST_BASE_URL', 'https://test.kobara.app/api/v1');

// Initialize the plugin when WooCommerce is loaded
add_action('plugins_loaded', 'kobara_init_gateway_class');
function kobara_init_gateway_class() {
    if (!class_exists('WooCommerce')) {
        return;
    }

    require_once KOBARA_PLUGIN_DIR . 'includes/class-kobara-api-client.php';
    require_once KOBARA_PLUGIN_DIR . 'includes/class-kobara-settings.php';
    require_once KOBARA_PLUGIN_DIR . 'includes/class-kobara-webhook.php';
    require_once KOBARA_PLUGIN_DIR . 'includes/class-kobara-woocommerce-gateway.php';

    $settings = get_option('woocommerce_kobara_settings', array());
    if (!empty($settings['webhook_secret'])) {
        new Kobara_Webhook($settings['webhook_secret']);
    }

    // Register Gateway
    add_filter('woocommerce_payment_gateways', 'kobara_add_gateway_class');
    function kobara_add_gateway_class($methods) {
        $methods[] = 'Kobara_WC_Gateway';
        return $methods;
    }
}

add_action('woocommerce_blocks_loaded', 'kobara_register_blocks_support');
function kobara_register_blocks_support() {
    if (!class_exists('Automattic\\WooCommerce\\Blocks\\Payments\\Integrations\\AbstractPaymentMethodType')) {
        return;
    }

    require_once KOBARA_PLUGIN_DIR . 'includes/class-kobara-blocks-support.php';

    add_action(
        'woocommerce_blocks_payment_method_type_registration',
        function($payment_method_registry) {
            $payment_method_registry->register(new Kobara_Blocks_Support());
        }
    );
}

add_filter('plugin_action_links_' . plugin_basename(__FILE__), 'kobara_plugin_action_links');
function kobara_plugin_action_links($links) {
    $settings_url = admin_url('admin.php?page=wc-settings&tab=checkout&section=kobara');
    array_unshift(
        $links,
        '<a href="' . esc_url($settings_url) . '">' . esc_html__('Settings', 'kobara-payments-for-woocommerce') . '</a>'
    );
    return $links;
}
