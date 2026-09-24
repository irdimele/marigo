from decimal import Decimal

import os

from django.db import transaction
from django.db.models import F
from django.shortcuts import get_object_or_404
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import generics, permissions, status, viewsets
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .filters import ProductFilter
from .emails import send_order_confirmation_email
from .models import (
    Address,
    Cart,
    CartItem,
    Category,
    ContactMessage,
    Order,
    OrderItem,
    Product,
    ProductImage,
    Wishlist,
)
from .permissions import IsStaffOrReadOnly
from .serializers import (
    AddressSerializer,
    CartItemSerializer,
    CartSerializer,
    CategorySerializer,
    ContactMessageSerializer,
    DashboardProductSerializer,
    OrderSerializer,
    ProductDetailSerializer,
    ProductListSerializer,
    RegisterSerializer,
    UserSerializer,
    WishlistSerializer,
)
from rest_framework.decorators import action


# ---------- helpers ----------


def get_or_create_cart(request):
    """Return the current cart: authenticated users by user, anon by session_key."""
    if request.user.is_authenticated:
        cart, _ = Cart.objects.get_or_create(user=request.user)
        # One-time merge: carry guest (session) items over after login/register.
        if request.session.session_key:
            guest = (
                Cart.objects.filter(
                    user=None, session_key=request.session.session_key
                )
                .exclude(pk=cart.pk)
                .first()
            )
            if guest:
                for g_item in guest.items.select_related("product"):
                    qty = g_item.quantity
                    if g_item.product.stock < qty:
                        qty = g_item.product.stock
                    if qty < 1:
                        continue
                    u_item, created = CartItem.objects.get_or_create(
                        cart=cart,
                        product=g_item.product,
                        color=g_item.color,
                        size=g_item.size,
                        defaults={"quantity": qty, "unit_price": g_item.unit_price},
                    )
                    if not created:
                        new_qty = u_item.quantity + qty
                        if g_item.product.stock < new_qty:
                            new_qty = g_item.product.stock
                        u_item.quantity = new_qty
                        u_item.unit_price = g_item.unit_price
                        u_item.save()
                guest.delete()
        return cart
    if not request.session.session_key:
        request.session.create()
    cart, _ = Cart.objects.get_or_create(
        user=None, session_key=request.session.session_key
    )
    return cart


# ---------- Category / Product ----------


class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all().prefetch_related("children")
    serializer_class = CategorySerializer
    permission_classes = [IsStaffOrReadOnly]
    lookup_field = "pk"


class ProductViewSet(viewsets.ModelViewSet):
    queryset = (
        Product.objects.filter(is_active=True)
        .select_related("category")
        .prefetch_related("images")
    )
    permission_classes = [IsStaffOrReadOnly]
    filterset_class = ProductFilter
    search_fields = ["name", "description", "sku"]
    ordering_fields = ["price", "created_at", "name", "is_best_seller"]
    ordering = ["-created_at"]

    def get_queryset(self):
        qs = Product.objects.select_related("category").prefetch_related("images")
        # Staff can see inactive products; public only sees active ones.
        if not (self.request.user and self.request.user.is_staff):
            qs = qs.filter(is_active=True)
        return qs

    def get_serializer_class(self):
        if self.action == "list":
            return ProductListSerializer
        return ProductDetailSerializer

    def get_object(self):
        lookup = self.kwargs.get(self.lookup_field, None)
        if lookup is not None and self.action == "retrieve":
            # Support lookup by pk OR slug so /api/products/<slug>/ works
            # alongside the default /api/products/<pk>/.
            qs = self.filter_queryset(self.get_queryset())
            try:
                return qs.get(pk=lookup)
            except (Product.DoesNotExist, ValueError):
                return get_object_or_404(qs, slug=lookup)
        return super().get_object()


# ---------- Cart ----------


class CartDetailView(APIView):
    permission_classes = [permissions.AllowAny]

    # Issue csrftoken cookie on first cart load so the SPA can send X-CSRFToken.
    @method_decorator(ensure_csrf_cookie)
    def get(self, request):
        cart = get_or_create_cart(request)
        return Response(CartSerializer(cart, context={"request": request}).data)


class CartAddView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        cart = get_or_create_cart(request)
        product_id = request.data.get("product_id") or request.data.get("product")
        try:
            quantity = int(request.data.get("quantity", 1))
        except (TypeError, ValueError):
            return Response({"detail": "quantity must be a valid integer."}, status=400)
        if not product_id:
            return Response({"detail": "product_id is required."}, status=400)
        if quantity < 1:
            return Response({"detail": "quantity must be >= 1."}, status=400)
        product = get_object_or_404(Product, pk=product_id, is_active=True)
        if product.stock < 1:
            return Response({"detail": "This product is out of stock."}, status=400)
        if product.stock < quantity:
            return Response(
                {"detail": f"Only {product.stock} left in stock."}, status=400
            )

        color = str(request.data.get("color") or "").strip()[:100]
        # Size only applies when category.has_size_options (Clothing).
        # Non-size categories always store "" (never the legacy "M" default).
        size = str(request.data.get("size") or "").strip()[:50]
        if not product.category.has_size_options:
            size = ""
        elif not size:
            size = "M"

        item, created = CartItem.objects.get_or_create(
            cart=cart,
            product=product,
            color=color,
            size=size,
            defaults={"quantity": 0, "unit_price": product.price},
        )
        # Snapshot current price.
        item.unit_price = product.price
        item.quantity = item.quantity + quantity if not created else quantity
        if product.stock < 1:
            return Response({"detail": "This product is out of stock."}, status=400)
        if product.stock < item.quantity:
            return Response(
                {"detail": f"Only {product.stock} left in stock."}, status=400
            )
        item.save()
        return Response(
            CartItemSerializer(item, context={"request": request}).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class CartItemUpdateDeleteView(APIView):
    permission_classes = [permissions.AllowAny]

    def _get_item(self, request, pk):
        cart = get_or_create_cart(request)
        return get_object_or_404(CartItem, pk=pk, cart=cart)

    def patch(self, request, pk):
        item = self._get_item(request, pk)
        quantity = request.data.get("quantity")
        if quantity is None:
            return Response({"detail": "quantity is required."}, status=400)
        try:
            quantity = int(quantity)
        except (TypeError, ValueError):
            return Response({"detail": "quantity must be a valid integer."}, status=400)
        if quantity < 1:
            return Response({"detail": "quantity must be >= 1."}, status=400)
        if item.product.stock < 1:
            return Response({"detail": "This product is out of stock."}, status=400)
        if item.product.stock < quantity:
            return Response(
                {"detail": f"Only {item.product.stock} left in stock."}, status=400
            )
        item.quantity = quantity
        item.save()
        return Response(CartItemSerializer(item, context={"request": request}).data)

    def put(self, request, pk):
        return self.patch(request, pk)

    def delete(self, request, pk):
        item = self._get_item(request, pk)
        item.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ---------- Checkout ----------


class CheckoutView(APIView):
    # Guests can place orders; contact = billing email on the form.
    permission_classes = [permissions.AllowAny]

    @transaction.atomic
    def post(self, request):
        cart = get_or_create_cart(request)
        items = list(cart.items.select_related("product").select_for_update())
        if not items:
            return Response({"detail": "Cart is empty."}, status=400)

        billing = request.data.get("billing")
        shipping_address = None
        billing_email = None
        customer_note = ""
        payment_method = request.data.get("payment_method") or "card"
        if payment_method not in ("card", "paypal"):
            payment_method = "card"
        # Billing snapshot defaults (legacy path without billing payload).
        billing_fields = {
            "first_name": "",
            "last_name": "",
            "country": "",
            "city": "",
            "zip_code": "",
            "address": "",
            "phone": "",
            "email": "",
            "recipient_address": "",
        }

        if billing is not None:
            # ---- Validate billing BEFORE any stock mutation ----
            errors = {}

            def required(key, label):
                val = str(billing.get(key) or "").strip()
                if not val:
                    errors[key] = [f"{label} is required."]
                return val

            first_name = required("first_name", "First name")
            last_name = required("last_name", "Last name")
            country = required("country", "Country")
            city = required("city", "City")
            postal_code = required("postal_code", "Zip code")
            if postal_code and "postal_code" not in errors:
                # Digits only, 4-9 characters — same rules as the Checkout form.
                if not postal_code.isdigit():
                    errors["postal_code"] = ["Zip code must contain digits only."]
                elif len(postal_code) < 4 or len(postal_code) > 9:
                    errors["postal_code"] = ["Zip code must be 4-9 digits."]
            line1 = required("line1", "Address")
            phone = required("phone", "Phone")
            if phone and "phone" not in errors:
                # Digits only — reject non-numeric input from any client (no leading +).
                if not phone.isdigit():
                    errors["phone"] = ["Phone number must contain digits only."]
                elif len(phone) < 7:
                    errors["phone"] = ["Phone number must be at least 7 digits."]
            billing_email = required("email", "Email")
            if billing_email and "email" not in errors:
                from django.core.validators import validate_email
                from django.core.exceptions import ValidationError as DjangoValidationError

                try:
                    validate_email(billing_email)
                except DjangoValidationError:
                    errors["email"] = ["Enter a valid email address."]
                billing_email = billing_email.lower()

            note = str(billing.get("note") or "").strip()
            customer_note = note[:2000]

            send_to_someone = bool(billing.get("send_to_someone"))
            recipient_line1 = str(billing.get("recipient_line1") or "").strip()
            if send_to_someone and not recipient_line1:
                errors["recipient_line1"] = ["Address is required."]

            if errors:
                return Response(errors, status=400)

            # Immutable billing snapshot on the order (never overwritten by gift ship-to).
            billing_fields = {
                "first_name": first_name,
                "last_name": last_name,
                "country": country,
                "city": city,
                "zip_code": postal_code,
                "address": line1,
                "phone": phone,
                "email": billing_email,
                "recipient_address": recipient_line1 if send_to_someone else "",
            }

            ship_line1 = recipient_line1 if send_to_someone else line1
            owner = request.user if request.user.is_authenticated else None
            shipping_address = Address.objects.create(
                user=owner,
                full_name=f"{first_name} {last_name}".strip(),
                line1=ship_line1,
                line2=str(billing.get("recipient_line2") or "").strip()
                if send_to_someone
                else str(billing.get("line2") or "").strip(),
                city=city,
                state=str(billing.get("state") or "").strip(),
                postal_code=postal_code,
                country=country,
                phone=phone,
            )
        else:
            # Legacy path: optional pre-saved address id (authenticated only).
            address_id = request.data.get("shipping_address") or request.data.get(
                "shipping_address_id"
            )
            if address_id and request.user.is_authenticated:
                shipping_address = get_object_or_404(
                    Address, pk=address_id, user=request.user
                )
                billing_fields = {
                    "first_name": shipping_address.full_name.split(" ", 1)[0],
                    "last_name": (
                        shipping_address.full_name.split(" ", 1)[1]
                        if " " in shipping_address.full_name
                        else ""
                    ),
                    "country": shipping_address.country,
                    "city": shipping_address.city,
                    "zip_code": shipping_address.postal_code,
                    "address": shipping_address.line1,
                    "phone": shipping_address.phone,
                    "email": "",
                    "recipient_address": "",
                }

        # Validate stock & compute total from snapshots (refresh to current price).
        total = Decimal("0")
        for item in items:
            product = Product.objects.select_for_update().get(pk=item.product_id)
            if not product.is_active:
                return Response(
                    {"detail": f"Product '{product.name}' is no longer available."},
                    status=400,
                )
            if product.stock < 1:
                return Response(
                    {
                        "detail": f"'{product.name}' is out of stock. Remove it from your cart to continue."
                    },
                    status=400,
                )
            if product.stock < item.quantity:
                return Response(
                    {
                        "detail": f"Only {product.stock} left of '{product.name}'. Reduce the quantity to continue."
                    },
                    status=400,
                )
            item.unit_price = product.price
            item.save(update_fields=["unit_price"])
            total += item.unit_price * item.quantity

        order = Order.objects.create(
            user=request.user if request.user.is_authenticated else None,
            status="pending",
            payment_method=payment_method,
            customer_note=customer_note,
            total_amount=total,
            shipping_address=shipping_address,
            **billing_fields,
        )
        for item in items:
            OrderItem.objects.create(
                order=order,
                product=item.product,
                color=item.color,
                size=item.size,
                quantity=item.quantity,
                unit_price=item.unit_price,
            )
            # Atomic stock decrement — F() ensures the DB computes
            # stock = stock - quantity in a single UPDATE, preventing
            # oversell even if select_for_update lock is ever relaxed.
            Product.objects.filter(pk=item.product_id).update(
                stock=F("stock") - item.quantity
            )

        # Clear cart.
        cart.items.all().delete()

        # Confirmation email fires only AFTER this transaction commits —
        # never for an order that gets rolled back.
        transaction.on_commit(
            lambda: send_order_confirmation_email(order, to_email=billing_email)
        )

        return Response(
            OrderSerializer(order, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


# ---------- Wishlist ----------


class WishlistView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        qs = (
            Wishlist.objects.filter(user=request.user)
            .select_related("product", "product__category")
            .prefetch_related("product__images")
        )
        return Response(
            WishlistSerializer(qs, many=True, context={"request": request}).data
        )

    def post(self, request):
        product_id = request.data.get("product_id") or request.data.get("product")
        if not product_id:
            return Response({"detail": "product_id is required."}, status=400)
        product = get_object_or_404(Product, pk=product_id, is_active=True)
        item, created = Wishlist.objects.get_or_create(
            user=request.user, product=product
        )
        return Response(
            WishlistSerializer(item, context={"request": request}).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class WishlistItemView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, product_id):
        deleted, _ = Wishlist.objects.filter(
            user=request.user, product_id=product_id
        ).delete()
        if not deleted:
            return Response({"detail": "Not found."}, status=404)
        return Response(status=status.HTTP_204_NO_CONTENT)


# ---------- Contact ----------


class ContactCreateView(generics.CreateAPIView):
    """Anonymous contact-form submissions, rate-limited per IP."""

    serializer_class = ContactMessageSerializer
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "contact"

    def perform_create(self, serializer):
        serializer.save()


# ---------- Orders / Addresses ----------


class OrderViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = Order.objects.prefetch_related("items__product").select_related(
            "shipping_address"
        )
        if self.request.user.is_staff:
            return qs.all()
        return qs.filter(user=self.request.user)


class AddressViewSet(viewsets.ModelViewSet):
    serializer_class = AddressSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Address.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


# ---------- Dashboard (staff only, read-only) ----------


class DashboardOrdersView(generics.ListAPIView):
    """All orders (incl. guests) for the client dashboard. Staff only."""

    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAdminUser]
    pagination_class = None

    def get_queryset(self):
        return (
            Order.objects.prefetch_related("items__product")
            .select_related("shipping_address")
            .order_by("-created_at")
        )


class DashboardMessagesView(generics.ListAPIView):
    """All contact-form submissions for the client dashboard. Staff only."""

    serializer_class = ContactMessageSerializer
    permission_classes = [permissions.IsAdminUser]
    pagination_class = None

    def get_queryset(self):
        return ContactMessage.objects.all()


class DashboardProductViewSet(viewsets.ModelViewSet):
    """Full product CRUD for the client dashboard. Staff only.

    DELETE permanently removes the product (and cascades ProductImage /
    CartItem / Wishlist rows). OrderItem.product is on_delete=SET_NULL so
    historical order lines keep price/qty and show as "Deleted product".
    Soft-hide from the shop is PATCH is_active=false (not DELETE).
    Multi-image upload: multipart fields `images` (repeatable) and/or
    legacy single `image`. Optional write-only `primary_image_id` /
    `primary_image_index` (via primary_new_index) choose the Shop primary.
    Color-linked gallery: repeat `image_colors` (aligned with `images`) tags
    each new file; `image_color_updates` is a JSON `{image_id: color}` map
    for already-uploaded rows.
    """

    serializer_class = DashboardProductSerializer
    permission_classes = [permissions.IsAdminUser]
    pagination_class = None
    http_method_names = ["get", "post", "put", "patch", "delete", "head", "options"]

    def get_queryset(self):
        return (
            Product.objects.select_related("category")
            .prefetch_related("images")
            .order_by("-created_at")
        )

    def perform_destroy(self, instance):
        # Collect media paths before cascade removes ProductImage rows.
        paths = []
        for img in instance.images.all():
            if img.image:
                try:
                    paths.append(img.image.path)
                except Exception:
                    pass
        instance.delete()  # hard delete; ProductImage/CartItem/Wishlist cascade
        for path in paths:
            if path and os.path.isfile(path):
                try:
                    os.remove(path)
                except OSError:
                    pass

    @action(detail=True, methods=["delete"], url_path=r"images/(?P<image_id>[0-9]+)")
    def delete_image(self, request, pk=None, image_id=None):
        """DELETE /api/dashboard/products/<pk>/images/<image_id>/"""
        product = self.get_object()
        img = get_object_or_404(ProductImage, pk=image_id, product=product)
        was_primary = img.is_primary
        if img.image:
            try:
                disk_path = img.image.path
            except Exception:
                disk_path = None
        else:
            disk_path = None
        img.delete()
        if was_primary:
            nxt = product.images.order_by("position", "id").first()
            if nxt:
                nxt.is_primary = True
                nxt.save(update_fields=["is_primary"])
        if disk_path and os.path.isfile(disk_path):
            try:
                os.remove(disk_path)
            except OSError:
                pass
        product = self.get_object()
        return Response(self.get_serializer(product).data)

    @action(
        detail=True,
        methods=["patch"],
        url_path=r"images/(?P<image_id>[0-9]+)/set-primary",
    )
    def set_primary_image(self, request, pk=None, image_id=None):
        """PATCH /api/dashboard/products/<pk>/images/<image_id>/set-primary/"""
        product = self.get_object()
        img = get_object_or_404(ProductImage, pk=image_id, product=product)
        product.images.filter(is_primary=True).exclude(pk=img.pk).update(
            is_primary=False
        )
        if not img.is_primary:
            img.is_primary = True
            img.save(update_fields=["is_primary"])
        product = self.get_object()
        return Response(self.get_serializer(product).data)


# ---------- Auth ----------


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "user": UserSerializer(user).data,
                "refresh": str(refresh),
                "access": str(refresh.access_token),
            },
            status=status.HTTP_201_CREATED,
        )


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)
