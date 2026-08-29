<?php
/**
 * Plugin Name: Kobara Payments for WooCommerce
 * Plugin URI: https://kobara.app/docs/wordpress-plugin
 * Description: Accept MonCash payments in WooCommerce through Kobara.
 * Version: 1.0.1
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
define('KOBARA_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('KOBARA_PLUGIN_URL', plugin_dir_url(__FILE__));
define('KOBARA_API_BASE_URL', 'https://api.kobara.app/v1');

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

    // Register Gateway
    add_filter('woocommerce_payment_gateways', 'kobara_add_gateway_class');
    function kobara_add_gateway_class($methods) {
        $methods[] = 'Kobara_WC_Gateway';
        return $methods;
    }
}
