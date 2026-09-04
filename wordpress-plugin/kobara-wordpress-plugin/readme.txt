=== Kobara Payments for WooCommerce ===
Contributors: kobara
Tags: woocommerce, payment gateway, moncash, natcash, haiti
Requires at least: 6.0
Tested up to: 6.7
Stable tag: 2.0.0
Requires PHP: 7.4
License: GPLv2 or later

Accept the local and international payment methods enabled on your Kobara account in WooCommerce.

== Description ==

Kobara Payments redirects customers to the secure Kobara checkout and updates the WooCommerce order after a signed payment webhook is received.

The unified checkout displays only the methods enabled for the merchant. A merchant may alternatively preselect MonCash, NatCash, card, PayPal, Apple Pay, or Google Pay in the gateway settings.

== Features ==

* Kobara unified checkout.
* Separate Sandbox and Production credentials.
* Classic Checkout and WooCommerce Checkout Blocks support.
* Signed webhook verification with timestamp tolerance.
* Automatic paid and failed order updates.
* HPOS compatibility.
* HTG and USD orders.

== Installation ==

1. Upload and activate the plugin ZIP.
2. Go to WooCommerce > Settings > Payments > Kobara Payments.
3. Select Sandbox or Production and enter the matching secret API key.
4. Enter the webhook signing secret from the same Kobara environment.
5. Add `https://your-store.example/?wc-api=kobara_webhook` as a Kobara webhook endpoint.
6. Enable the gateway and place a test order before switching to Production.

Never place a Production key in Sandbox mode or a Sandbox key in Production mode.

== Changelog ==

= 2.0.0 =
* Added the Kobara unified checkout and all supported provider selections.
* Added dedicated Sandbox and Production API routing.
* Added WooCommerce Checkout Blocks support.
* Added Kobara branding to checkout and gateway settings.
* Corrected decimal payment amounts and customer data.
* Upgraded webhook verification to the timestamped Kobara v2 signature.
* Added automatic failed-order updates and safer API error handling.

= 1.0.1 =
* Fixed checkout URL compatibility with the Kobara API.
* Improved API error messages and retry idempotency.

= 1.0.0 =
* Initial release.
