(function () {
    'use strict';

    var settings = window.wc.wcSettings.getSetting('kobara_data', {});
    var createElement = window.wp.element.createElement;
    var decodeEntities = window.wp.htmlEntities.decodeEntities;
    var label = decodeEntities(settings.title || 'Payer avec Kobara');

    var Label = function (props) {
        var PaymentMethodLabel = props.components.PaymentMethodLabel;

        return createElement(
            'span',
            { className: 'kobara-blocks-label' },
            createElement(PaymentMethodLabel, { text: label }),
            settings.icon
                ? createElement('img', {
                    src: settings.icon,
                    alt: 'Kobara',
                    style: { height: '28px', width: '28px', objectFit: 'contain', marginLeft: '10px' }
                })
                : null
        );
    };

    var Content = function () {
        return createElement('div', null, decodeEntities(settings.description || ''));
    };

    window.wc.wcBlocksRegistry.registerPaymentMethod({
        name: 'kobara',
        label: createElement(Label, null),
        content: createElement(Content, null),
        edit: createElement(Content, null),
        canMakePayment: function () { return true; },
        ariaLabel: label,
        supports: { features: settings.supports || ['products'] }
    });
}());
