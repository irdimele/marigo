"""Order-related outbound email. Sends fire after transaction commit."""

import logging

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string

logger = logging.getLogger(__name__)


def _receive_phrase(order):
    names = [
        item.product.name
        for item in order.items.all()
        if item.product_id and item.product
    ]
    if len(names) == 1:
        return f"your {names[0]}"
    return "your items"


def send_order_confirmation_email(order, to_email=None):
    """Render + send the order confirmation email.

    Never raises: an SMTP failure must not surface as a 500 on an order
    that has already been committed.
    """
    try:
        recipient = to_email or order.user.email
        if not recipient:
            logger.warning(
                "Order %s has no recipient email; skipping confirmation", order.pk
            )
            return

        raw_items = list(order.items.select_related("product"))
        # Precompute line totals — Django templates can't multiply decimals.
        items = [
            {
                "name": item.product.name if item.product else "Item",
                "quantity": item.quantity,
                "line_total": int(item.unit_price * item.quantity),
            }
            for item in raw_items
        ]
        context = {
            "order": order,
            "items": items,
            "receive_phrase": _receive_phrase(order),
            "footer_email": "hello@marigo.al",
        }
        subject = "Thank You For Your Order!"
        text_body = render_to_string("emails/order_confirmation.txt", context)
        html_body = render_to_string("emails/order_confirmation.html", context)

        message = EmailMultiAlternatives(
            subject,
            text_body,
            settings.DEFAULT_FROM_EMAIL,
            [recipient],
            reply_to=[settings.DEFAULT_FROM_EMAIL],
        )
        message.attach_alternative(html_body, "text/html")
        message.send(fail_silently=True)
    except Exception:
        logger.exception("Failed to send confirmation email for order %s", order.pk)
