"""Marigo E2E Phase 1 — backend API tests (Django test runner + DRF APIClient).

Run (throwaway DB, temp media):
    DATABASE_URL=sqlite:///test_e2e.sqlite3 MEDIA_ROOT=<temp> python manage.py test store -v 2

Users under test: anonymous, guest (session cart), customer A, customer B, staff.
"""
import io
import threading
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core import mail
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, TransactionTestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken

from .models import (
    Cart,
    Category,
    ContactMessage,
    Order,
    OrderItem,
    Product,
    ProductImage,
    Wishlist,
)

# Throwaway media folder for image-upload tests (deleted at process exit).
import atexit
import shutil
import tempfile

TEST_MEDIA = tempfile.mkdtemp(prefix="marigo-test-media-")
atexit.register(shutil.rmtree, TEST_MEDIA, ignore_errors=True)


def tiny_png(name="t.png"):
    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", (4, 4), (200, 30, 30)).save(buf, format="PNG")
    return SimpleUploadedFile(name, buf.getvalue(), content_type="image/png")


def auth_client(user):
    c = APIClient()
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {AccessToken.for_user(user)}")
    return c


def billing(**over):
    data = {
        "first_name": "Irdi",
        "last_name": "Mele",
        "country": "Albania",
        "city": "Tirana",
        "postal_code": "1019",
        "line1": "Rruga Myslym Shyri",
        "phone": "0691234567",
        "email": "buyer@test.com",
        "note": "",
        "send_to_someone": False,
    }
    data.update(over)
    return data


class Base(TestCase):
    """Shared fixtures: users A/B/staff, clothing + souvenir products."""

    @classmethod
    def setUpTestData(cls):
        User = get_user_model()
        cls.user_a = User.objects.create_user(
            "a@test.com", "a@test.com", "Pass-word-1", first_name="Customer",
            last_name="Alpha",
        )
        cls.user_b = User.objects.create_user(
            "b@test.com", "b@test.com", "Pass-word-2", first_name="Customer",
            last_name="Beta",
        )
        cls.staff = User.objects.create_user(
            "staff@test.com", "staff@test.com", "Staff-pass-1",
            first_name="Staff", last_name="User", is_staff=True,
        )
        cls.clothing = Category.objects.create(
            name="Clothing", slug="clothing",
            has_color_options=True, has_size_options=True,
        )
        cls.souvenirs = Category.objects.create(
            name="Souvenirs", slug="souvenirs",
            has_color_options=False, has_size_options=False,
        )
        cls.shirt = Product.objects.create(
            name="White Tee", slug="white-tee", category=cls.clothing,
            price=Decimal("25.00"), stock=10, sku="SKU-TEE",
        )
        cls.mug = Product.objects.create(
            name="Tirana Mug", slug="tirana-mug", category=cls.souvenirs,
            price=Decimal("15.00"), stock=5, sku="SKU-MUG",
        )
        cls.last_unit = Product.objects.create(
            name="Last Scarf", slug="last-scarf", category=cls.souvenirs,
            price=Decimal("10.00"), stock=1, sku="SKU-SCARF",
        )
        cls.oos = Product.objects.create(
            name="Gone Hat", slug="gone-hat", category=cls.souvenirs,
            price=Decimal("20.00"), stock=0, sku="SKU-HAT",
        )

    def setUp(self):
        cache.clear()  # reset scoped throttle history between tests

    # helpers -----------------------------------------------------------
    def guest(self):
        return APIClient()

    def a(self):
        return auth_client(self.user_a)

    def b(self):
        return auth_client(self.user_b)

    def staff_c(self):
        return auth_client(self.staff)

    def fill_cart(self, client, product, qty=1, color="", size=""):
        return client.post(
            "/api/cart/add/",
            {"product_id": product.id, "quantity": qty, "color": color,
             "size": size},
            format="json",
        )

    def place_order(self, client, **bill_over):
        return client.post(
            "/api/checkout/",
            {"billing": billing(**bill_over), "payment_method": "card"},
            format="json",
        )


# ---------------------------------------------------------------------
# AUTH
# ---------------------------------------------------------------------


class AuthTests(Base):
    def test_register_success_full_name_with_space(self):
        resp = self.guest().post(
            "/api/auth/register/",
            {"full_name": "Irdi Mele", "email": "irdi@example.com",
             "password": "longenough1"},
            format="json",
        )
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertIn("access", resp.data)
        self.assertIn("refresh", resp.data)
        self.assertEqual(resp.data["user"]["first_name"], "Irdi")
        self.assertEqual(resp.data["user"]["last_name"], "Mele")
        self.assertEqual(resp.data["user"]["email"], "irdi@example.com")

    def test_register_duplicate_email_rejected(self):
        self.guest().post(
            "/api/auth/register/",
            {"full_name": "First User", "email": "dup@example.com",
             "password": "longenough1"},
            format="json",
        )
        resp = self.guest().post(
            "/api/auth/register/",
            {"full_name": "Second User", "email": "DUP@example.com",
             "password": "longenough1"},
            format="json",
        )
        self.assertEqual(resp.status_code, 400, resp.data)
        self.assertIn("email", resp.data)

    def test_register_missing_fields_rejected(self):
        resp = self.guest().post("/api/auth/register/", {}, format="json")
        self.assertEqual(resp.status_code, 400, resp.data)
        for field in ("full_name", "email", "password"):
            self.assertIn(field, resp.data)

    def test_register_too_short_password_rejected(self):
        resp = self.guest().post(
            "/api/auth/register/",
            {"full_name": "Short Pw", "email": "short@example.com",
             "password": "ab12"},
            format="json",
        )
        self.assertEqual(resp.status_code, 400, resp.data)
        self.assertIn("password", resp.data)

    def test_register_invalid_email_rejected(self):
        resp = self.guest().post(
            "/api/auth/register/",
            {"full_name": "No Mail", "email": "not-an-email",
             "password": "longenough1"},
            format="json",
        )
        self.assertEqual(resp.status_code, 400, resp.data)
        self.assertIn("email", resp.data)

    def test_login_right_password(self):
        resp = self.guest().post(
            "/api/token/",
            {"email": "a@test.com", "password": "Pass-word-1"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertIn("access", resp.data)
        self.assertIn("refresh", resp.data)

    def test_login_wrong_password(self):
        resp = self.guest().post(
            "/api/token/",
            {"email": "a@test.com", "password": "wrong-password"},
            format="json",
        )
        self.assertEqual(resp.status_code, 401, resp.data)

    def test_login_unknown_email(self):
        resp = self.guest().post(
            "/api/token/",
            {"email": "ghost@test.com", "password": "whatever-1"},
            format="json",
        )
        self.assertEqual(resp.status_code, 401, resp.data)

    def test_token_refresh_returns_new_access(self):
        login = self.guest().post(
            "/api/token/",
            {"email": "a@test.com", "password": "Pass-word-1"},
            format="json",
        )
        resp = self.guest().post(
            "/api/token/refresh/", {"refresh": login.data["refresh"]},
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertIn("access", resp.data)

    def test_expired_refresh_token_rejected(self):
        refresh = RefreshToken.for_user(self.user_a)
        refresh.set_exp(lifetime=timedelta(seconds=-5))
        resp = self.guest().post(
            "/api/token/refresh/", {"refresh": str(refresh)}, format="json"
        )
        self.assertEqual(resp.status_code, 401, resp.data)

    def test_invalid_refresh_token_rejected(self):
        resp = self.guest().post(
            "/api/token/refresh/", {"refresh": "garbage.token.value"},
            format="json",
        )
        self.assertEqual(resp.status_code, 401, resp.data)

    def test_me_endpoint_requires_login_and_returns_profile(self):
        resp = self.guest().get("/api/auth/me/")
        self.assertEqual(resp.status_code, 401, resp.data)
        resp = self.a().get("/api/auth/me/")
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(resp.data["email"], "a@test.com")


# ---------------------------------------------------------------------
# PERMISSIONS — dashboard matrix + cross-user isolation
# ---------------------------------------------------------------------


class PermissionMatrixTests(Base):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.order_a = Order.objects.create(
            user=cls.user_a, total_amount=Decimal("25.00"),
            first_name="Customer", last_name="Alpha", email="a@test.com",
        )
        cls.message = ContactMessage.objects.create(
            name="Visitor", email="v@test.com", message="Hello there team"
        )

    DASH_GETS = [
        "/api/dashboard/orders/",
        "/api/dashboard/revenue/?start=2026-01-01&end=2026-01-31",
        "/api/dashboard/messages/",
        "/api/dashboard/products/",
    ]

    def test_dashboard_gets_anonymous_401(self):
        for url in self.DASH_GETS:
            resp = self.guest().get(url)
            self.assertEqual(resp.status_code, 401, f"{url} -> {resp.status_code}")

    def test_dashboard_gets_customer_403(self):
        for url in self.DASH_GETS:
            resp = self.a().get(url)
            self.assertEqual(resp.status_code, 403, f"{url} -> {resp.status_code}")

    def test_dashboard_gets_staff_200(self):
        for url in self.DASH_GETS:
            resp = self.staff_c().get(url)
            self.assertEqual(resp.status_code, 200, f"{url} -> {resp.status_code}")

    def test_dashboard_mark_done_permission_matrix(self):
        url = f"/api/dashboard/orders/{self.order_a.id}/"
        self.assertEqual(self.guest().patch(url, {"is_done": True}, format="json").status_code, 401)
        self.assertEqual(self.a().patch(url, {"is_done": True}, format="json").status_code, 403)
        resp = self.staff_c().patch(url, {"is_done": True}, format="json")
        self.assertEqual(resp.status_code, 200, resp.data)

    def test_dashboard_bulk_delete_permission_matrix(self):
        url = "/api/dashboard/messages/bulk-delete/"
        payload = {"ids": [self.message.id]}
        self.assertEqual(self.guest().post(url, payload, format="json").status_code, 401)
        self.assertEqual(self.a().post(url, payload, format="json").status_code, 403)
        resp = self.staff_c().post(url, payload, format="json")
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(resp.data.get("deleted"), 1)

    def test_dashboard_message_delete_permission_matrix(self):
        ContactMessage.objects.create(name="Del", email="d@t.com", message="to delete 10+")
        msg = ContactMessage.objects.first()
        url = f"/api/dashboard/messages/{msg.id}/"
        self.assertEqual(self.guest().delete(url).status_code, 401)
        self.assertEqual(self.a().delete(url).status_code, 403)
        self.assertEqual(self.staff_c().delete(url).status_code, 204)

    def test_dashboard_product_write_permission_matrix(self):
        # create
        payload = {"name": "Matrix Item", "category_id": self.souvenirs.id,
                   "price": "9.99", "stock": 3}
        self.assertEqual(
            self.guest().post("/api/dashboard/products/", payload, format="json").status_code, 401)
        self.assertEqual(
            self.a().post("/api/dashboard/products/", payload, format="json").status_code, 403)
        resp = self.staff_c().post("/api/dashboard/products/", payload, format="json")
        self.assertEqual(resp.status_code, 201, resp.data)
        pid = resp.data["id"]
        # add-stock form (PATCH stock)
        self.assertEqual(
            self.guest().patch(f"/api/dashboard/products/{pid}/", {"stock": 5},
                               format="json").status_code, 401)
        self.assertEqual(
            self.a().patch(f"/api/dashboard/products/{pid}/", {"stock": 5},
                           format="json").status_code, 403)
        resp = self.staff_c().patch(f"/api/dashboard/products/{pid}/",
                                    {"stock": 12}, format="json")
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(resp.data["stock"], 12)
        # delete
        self.assertEqual(
            self.guest().delete(f"/api/dashboard/products/{pid}/").status_code, 401)
        self.assertEqual(
            self.a().delete(f"/api/dashboard/products/{pid}/").status_code, 403)
        self.assertEqual(
            self.staff_c().delete(f"/api/dashboard/products/{pid}/").status_code, 204)

    def test_public_product_write_permission_matrix(self):
        payload = {"name": "Nope", "category_id": self.souvenirs.id,
                   "price": "1.00", "stock": 1}
        self.assertEqual(
            self.guest().post("/api/products/", payload, format="json").status_code, 401)
        self.assertEqual(
            self.a().post("/api/products/", payload, format="json").status_code, 403)
        # staff can via IsStaffOrReadOnly (detail serializer is not a write
        # serializer for the public router — accept any non-403 signal)
        resp = self.staff_c().post("/api/products/", payload, format="json")
        self.assertNotIn(resp.status_code, (401, 403), resp.data)

    def test_customer_a_cannot_read_customer_b_orders(self):
        order_b = Order.objects.create(
            user=self.user_b, total_amount=Decimal("15.00"),
            first_name="Customer", last_name="Beta", email="b@test.com",
        )
        resp = self.a().get("/api/orders/")
        self.assertEqual(resp.status_code, 200, resp.data)
        ids = [o["id"] for o in resp.data["results"]] if isinstance(resp.data, dict) else [o["id"] for o in resp.data]
        self.assertIn(self.order_a.id, ids)
        self.assertNotIn(order_b.id, ids)
        # direct detail access
        resp = self.a().get(f"/api/orders/{order_b.id}/")
        self.assertEqual(resp.status_code, 404, resp.data)
        resp = self.b().get(f"/api/orders/{self.order_a.id}/")
        self.assertEqual(resp.status_code, 404, resp.data)

    def test_customer_a_cannot_see_customer_b_wishlist(self):
        Wishlist.objects.create(user=self.user_b, product=self.shirt)
        resp = self.a().get("/api/wishlist/")
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(resp.data, [])
        resp = self.a().delete(f"/api/wishlist/{self.shirt.id}/")
        self.assertEqual(resp.status_code, 404, resp.data)
        # B still has it
        resp = self.b().get("/api/wishlist/")
        self.assertEqual(len(resp.data), 1)

    def test_wishlist_requires_login(self):
        self.assertEqual(self.guest().get("/api/wishlist/").status_code, 401)
        self.assertEqual(
            self.guest().post("/api/wishlist/", {"product_id": self.shirt.id},
                              format="json").status_code, 401)

    def test_orders_list_requires_login(self):
        self.assertEqual(self.guest().get("/api/orders/").status_code, 401)
        self.assertEqual(self.a().get("/api/orders/").status_code, 200)

    def test_two_guests_never_share_carts(self):
        g1, g2 = self.guest(), self.guest()
        resp = self.fill_cart(g1, self.shirt, qty=2)
        self.assertEqual(resp.status_code, 201, resp.data)
        cart2 = g2.get("/api/cart/")
        self.assertEqual(cart2.status_code, 200)
        self.assertEqual(cart2.data["items"], [])
        cart1 = g1.get("/api/cart/")
        self.assertEqual(len(cart1.data["items"]), 1)


# ---------------------------------------------------------------------
# CART + STOCK
# ---------------------------------------------------------------------


class CartStockTests(Base):
    def test_add_change_remove_lifecycle(self):
        g = self.guest()
        resp = self.fill_cart(g, self.shirt, qty=2, color="White", size="L")
        self.assertEqual(resp.status_code, 201, resp.data)
        item_id = resp.data["id"]
        cart = g.get("/api/cart/")
        self.assertEqual(len(cart.data["items"]), 1)
        self.assertEqual(cart.data["total_items"], 2)
        # change quantity
        resp = g.patch(f"/api/cart/items/{item_id}/", {"quantity": 3},
                       format="json")
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(resp.data["quantity"], 3)
        # remove
        resp = g.delete(f"/api/cart/items/{item_id}/")
        self.assertEqual(resp.status_code, 204)
        cart = g.get("/api/cart/")
        self.assertEqual(cart.data["items"], [])

    def test_quantity_zero_rejected(self):
        g = self.guest()
        item_id = self.fill_cart(g, self.shirt).data["id"]
        resp = g.patch(f"/api/cart/items/{item_id}/", {"quantity": 0},
                       format="json")
        self.assertEqual(resp.status_code, 400, resp.data)
        resp = g.post("/api/cart/add/",
                      {"product_id": self.shirt.id, "quantity": 0},
                      format="json")
        self.assertEqual(resp.status_code, 400, resp.data)

    def test_quantity_negative_rejected(self):
        g = self.guest()
        item_id = self.fill_cart(g, self.shirt).data["id"]
        resp = g.patch(f"/api/cart/items/{item_id}/", {"quantity": -2},
                       format="json")
        self.assertEqual(resp.status_code, 400, resp.data)
        resp = g.post("/api/cart/add/",
                      {"product_id": self.shirt.id, "quantity": -2},
                      format="json")
        self.assertEqual(resp.status_code, 400, resp.data)

    def test_quantity_above_stock_rejected_server_side(self):
        g = self.guest()
        # shirt stock = 10
        resp = self.fill_cart(g, self.shirt, qty=11)
        self.assertEqual(resp.status_code, 400, resp.data)
        self.assertIn("10", str(resp.data))
        # PATCH above stock
        item_id = self.fill_cart(g, self.shirt, qty=9).data["id"]
        resp = g.patch(f"/api/cart/items/{item_id}/", {"quantity": 99},
                       format="json")
        self.assertEqual(resp.status_code, 400, resp.data)

    def test_out_of_stock_product_rejected(self):
        resp = self.fill_cart(self.guest(), self.oos, qty=1)
        self.assertEqual(resp.status_code, 400, resp.data)
        self.assertIn("out of stock", str(resp.data).lower())

    def test_clothing_saves_color_and_size(self):
        g = self.guest()
        resp = self.fill_cart(g, self.shirt, color="Black", size="XL")
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(resp.data["color"], "Black")
        self.assertEqual(resp.data["size"], "XL")

    def test_clothing_size_defaults_to_m(self):
        g = self.guest()
        resp = self.fill_cart(g, self.shirt, color="White", size="")
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(resp.data["size"], "M")

    def test_non_clothing_stores_no_size_no_color(self):
        g = self.guest()
        resp = self.fill_cart(g, self.mug, color="Red", size="L")
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(resp.data["size"], "",
                         "non-size category must store empty size")
        self.assertEqual(
            resp.data["color"], "",
            "non-color category must store empty color (spec: stores null)")

    def test_cart_totals_use_server_prices(self):
        g = self.guest()
        self.fill_cart(g, self.shirt, qty=2)
        self.fill_cart(g, self.mug, qty=1)
        cart = g.get("/api/cart/")
        # hand-computed: 2 * 25.00 + 1 * 15.00 = 65.00
        self.assertEqual(Decimal(cart.data["total_amount"]), Decimal("65.00"))
        self.assertEqual(cart.data["total_items"], 3)

    def test_cannot_touch_another_guests_cart_item(self):
        g1, g2 = self.guest(), self.guest()
        item_id = self.fill_cart(g1, self.shirt).data["id"]
        self.assertEqual(
            g2.patch(f"/api/cart/items/{item_id}/", {"quantity": 2},
                     format="json").status_code, 404)
        self.assertEqual(
            g2.delete(f"/api/cart/items/{item_id}/").status_code, 404)


# ---------------------------------------------------------------------
# CHECKOUT
# ---------------------------------------------------------------------


class CheckoutTests(Base):
    def test_guest_checkout_saves_all_fields_and_totals(self):
        g = self.guest()
        self.fill_cart(g, self.shirt, qty=2, color="White", size="L")
        self.fill_cart(g, self.mug, qty=1, color="", size="")
        with self.captureOnCommitCallbacks(execute=True):
            resp = self.place_order(
                g, note="Please gift wrap", send_to_someone=True,
                recipient_line1="Rruga e Diturise 5",
                recipient_line2="", state="", line2="Apt 2",
            )
        self.assertEqual(resp.status_code, 201, resp.data)
        data = resp.data
        # hand-computed total: 2 * 25.00 + 1 * 15.00 = 65.00
        self.assertEqual(Decimal(data["total_amount"]), Decimal("65.00"))
        self.assertEqual(data["first_name"], "Irdi")
        self.assertEqual(data["last_name"], "Mele")
        self.assertEqual(data["country"], "Albania")
        self.assertEqual(data["city"], "Tirana")
        self.assertEqual(data["zip_code"], "1019")
        self.assertEqual(data["address"], "Rruga Myslym Shyri")
        self.assertEqual(data["phone"], "0691234567")
        self.assertEqual(data["email"], "buyer@test.com")
        self.assertEqual(data["recipient_address"], "Rruga e Diturise 5")
        self.assertEqual(data["customer_note"], "Please gift wrap")
        self.assertIsNone(data["user"])
        # items with color/size
        items = {i["product"]["name"]: i for i in data["items"]}
        self.assertEqual(items["White Tee"]["color"], "White")
        self.assertEqual(items["White Tee"]["size"], "L")
        self.assertEqual(Decimal(items["White Tee"]["unit_price"]), Decimal("25.00"))
        self.assertEqual(items["White Tee"]["quantity"], 2)
        self.assertEqual(items["Tirana Mug"]["color"], "")
        self.assertEqual(items["Tirana Mug"]["size"], "")
        # cart cleared, stock decreased
        self.assertEqual(g.get("/api/cart/").data["items"], [])
        self.shirt.refresh_from_db()
        self.mug.refresh_from_db()
        self.assertEqual(self.shirt.stock, 8)   # 10 - 2
        self.assertEqual(self.mug.stock, 4)     # 5 - 1
        # separate shipping address row carries the gift recipient
        self.assertIsNotNone(data["shipping_address"])
        self.assertEqual(data["shipping_address"]["line1"],
                         "Rruga e Diturise 5")

    def test_logged_in_checkout_links_user_and_sends_email(self):
        c = self.a()
        self.fill_cart(c, self.shirt, qty=1)
        with self.captureOnCommitCallbacks(execute=True):
            resp = self.place_order(c, email="a@test.com")
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(resp.data["user"], self.user_a.id)
        # confirmation email generated with the right items, sent to the
        # billing email from the checkout form
        self.assertEqual(len(mail.outbox), 1)
        msg = mail.outbox[0]
        self.assertEqual(msg.subject, "Thank You For Your Order!")
        self.assertIn("White Tee", msg.body)
        self.assertIn("a@test.com", msg.to)

    def test_order_total_is_server_side_tamper_ignored(self):
        g = self.guest()
        self.fill_cart(g, self.shirt, qty=2)
        with self.captureOnCommitCallbacks(execute=True):
            resp = g.post(
                "/api/checkout/",
                {
                    "billing": billing(),
                    "payment_method": "card",
                    # tamper attempts:
                    "total_amount": "0.01",
                    "price": "0.01",
                    "items": [{"product_id": self.shirt.id, "unit_price": "0.01",
                               "quantity": 2}],
                },
                format="json",
            )
        self.assertEqual(resp.status_code, 201, resp.data)
        # hand-computed: 2 * 25.00 = 50.00 — tampered fields ignored
        self.assertEqual(Decimal(resp.data["total_amount"]), Decimal("50.00"))
        order = Order.objects.get(pk=resp.data["id"])
        self.assertEqual(order.total_amount, Decimal("50.00"))
        self.assertEqual(order.items.first().unit_price, Decimal("25.00"))

    def test_phone_digits_only_min_7(self):
        g = self.guest()
        self.fill_cart(g, self.mug)
        resp = self.place_order(g, phone="abc12345")
        self.assertEqual(resp.status_code, 400, resp.data)
        self.assertIn("phone", resp.data)
        g = self.guest()
        self.fill_cart(g, self.mug)
        resp = self.place_order(g, phone="123456")
        self.assertEqual(resp.status_code, 400, resp.data)
        g = self.guest()
        self.fill_cart(g, self.mug)
        resp = self.place_order(g, phone="1234567890")
        self.assertEqual(resp.status_code, 201, resp.data)

    def test_zip_digits_only_4_to_9(self):
        for bad in ("12", "1234567890", "abcd1234"):
            g = self.guest()
            self.fill_cart(g, self.mug)
            resp = self.place_order(g, postal_code=bad)
            self.assertEqual(resp.status_code, 400, resp.data)
            self.assertIn("postal_code", resp.data, bad)
        for good in ("1234", "123456789"):
            g = self.guest()
            self.fill_cart(g, self.mug)
            resp = self.place_order(g, postal_code=good)
            self.assertEqual(resp.status_code, 201, resp.data)

    def test_missing_required_fields_rejected(self):
        for field in ("first_name", "last_name", "country", "city",
                      "postal_code", "line1", "phone", "email"):
            g = self.guest()
            self.fill_cart(g, self.mug)
            data = billing(**{field: ""})
            resp = self.place_order(g, **{field: ""})
            self.assertEqual(resp.status_code, 400, resp.data)
            self.assertIn(field, resp.data, f"missing {field} not rejected")
        # invalid email format
        g = self.guest()
        self.fill_cart(g, self.mug)
        resp = self.place_order(g, email="not-an-email")
        self.assertEqual(resp.status_code, 400, resp.data)
        self.assertIn("email", resp.data)

    def test_send_to_someone_requires_recipient_address(self):
        g = self.guest()
        self.fill_cart(g, self.mug)
        resp = self.place_order(g, send_to_someone=True, recipient_line1="")
        self.assertEqual(resp.status_code, 400, resp.data)
        self.assertIn("recipient_line1", resp.data)

    def test_customer_note_stored_plain(self):
        g = self.guest()
        self.fill_cart(g, self.mug)
        payload_note = "<script>alert('xss')</script>hello"
        with self.captureOnCommitCallbacks(execute=True):
            resp = self.place_order(g, note=payload_note)
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(resp.data["customer_note"], payload_note)

    def test_empty_cart_checkout_rejected(self):
        resp = self.place_order(self.guest())
        self.assertEqual(resp.status_code, 400, resp.data)
        self.assertIn("empty", str(resp.data).lower())

    def test_checkout_above_stock_rejected(self):
        g = self.guest()
        # add qty 9 ok, then lower stock server-side, checkout must fail
        self.fill_cart(g, self.shirt, qty=9)
        Product.objects.filter(pk=self.shirt.pk).update(stock=3)
        resp = self.place_order(g)
        self.assertEqual(resp.status_code, 400, resp.data)
        # no order created, stock untouched
        self.assertEqual(Order.objects.count(), 0)
        self.shirt.refresh_from_db()
        self.assertEqual(self.shirt.stock, 3)

    def test_stock_never_below_zero_after_order(self):
        g = self.guest()
        self.fill_cart(g, self.last_unit, qty=1)
        with self.captureOnCommitCallbacks(execute=True):
            resp = self.place_order(g)
        self.assertEqual(resp.status_code, 201, resp.data)
        self.last_unit.refresh_from_db()
        self.assertEqual(self.last_unit.stock, 0)
        # second buyer cannot order it anymore
        g2 = self.guest()
        self.fill_cart(g2, self.last_unit, qty=1)
        resp = self.place_order(g2)
        self.assertEqual(resp.status_code, 400, resp.data)
        self.last_unit.refresh_from_db()
        self.assertEqual(self.last_unit.stock, 0)


class CheckoutRaceTests(TransactionTestCase):
    """Two simultaneous orders for the last unit: exactly one succeeds."""

    def setUp(self):
        cache.clear()
        self.souvenirs = Category.objects.create(
            name="Souvenirs", slug="souvenirs")
        self.product = Product.objects.create(
            name="Race Scarf", slug="race-scarf", category=self.souvenirs,
            price=Decimal("10.00"), stock=1, sku="SKU-RACE",
        )

    def _buyer(self):
        c = APIClient()
        c.post("/api/cart/add/",
               {"product_id": self.product.id, "quantity": 1},
               format="json")
        return c

    def test_two_simultaneous_orders_for_last_unit(self):
        clients = [self._buyer(), self._buyer()]
        barrier = threading.Barrier(2, timeout=15)
        results, errors = [], []

        def buy(client, idx):
            from django.db import connections
            try:
                barrier.wait(timeout=15)
                resp = client.post(
                    "/api/checkout/",
                    {"billing": billing(), "payment_method": "card"},
                    format="json",
                )
                results.append((idx, resp.status_code))
                print(f"RACE thread{idx} -> HTTP {resp.status_code}")
            except Exception:  # noqa: BLE001 — record, then report
                import traceback
                errors.append((idx, traceback.format_exc()))
                results.append((idx, 500))
                print(f"RACE thread{idx} -> EXCEPTION")
            finally:
                connections.close_all()  # release file locks for teardown

        self.product.refresh_from_db()
        print(f"RACE before: stock={self.product.stock} "
              f"orders={Order.objects.count()}")
        threads = [threading.Thread(target=buy, args=(c, i))
                   for i, c in enumerate(clients)]
        for t in threads:
            t.start()
        for t in threads:
            t.join(timeout=30)

        self.product.refresh_from_db()
        order_rows = list(
            Order.objects.values_list("id", "status", "total_amount"))
        print(f"RACE results={results} "
              f"stock={self.product.stock} orders={order_rows}")
        for idx, tb in errors:
            print(f"--- RACE thread{idx} traceback ---\n{tb}")

        self.assertEqual(
            len([r for r in results if r[1] == 201]), 1,
            f"exactly one checkout must succeed: {results}")
        self.assertEqual(len(results), 2, f"both must complete: {results}")
        self.assertGreaterEqual(self.product.stock, 0,
                                "stock went negative")
        self.assertEqual(self.product.stock, 0)
        self.assertEqual(Order.objects.count(), 1)


# ---------------------------------------------------------------------
# CONTACT
# ---------------------------------------------------------------------


class ContactTests(Base):
    def test_contact_saves(self):
        resp = self.guest().post(
            "/api/contact/",
            {"name": "Visitor One", "email": "visit@test.com",
             "message": "This is a long enough message."},
            format="json",
        )
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(ContactMessage.objects.count(), 1)

    def test_contact_invalid_rejected(self):
        cases = [
            {"name": "X", "email": "a@b.com",
             "message": "long enough message"},        # name too short
            {"name": "Ok Name", "email": "bad",
             "message": "long enough message"},        # bad email
            {"name": "Ok Name", "email": "a@b.com",
             "message": "short"},                      # message < 10
        ]
        for payload in cases:
            resp = self.guest().post("/api/contact/", payload, format="json")
            self.assertEqual(resp.status_code, 400, resp.data)

    def test_message_visible_to_staff_only(self):
        self.guest().post(
            "/api/contact/",
            {"name": "Staff Eyes", "email": "se@t.com",
             "message": "only staff should read this"},
            format="json",
        )
        self.assertEqual(self.guest().get("/api/dashboard/messages/").status_code, 401)
        self.assertEqual(self.a().get("/api/dashboard/messages/").status_code, 403)
        staff = self.staff_c()
        resp = staff.get("/api/dashboard/messages/")
        self.assertEqual(resp.status_code, 200)
        names = [m["name"] for m in resp.data]
        self.assertIn("Staff Eyes", names)

    def test_single_delete_and_404(self):
        m = ContactMessage.objects.create(
            name="Del Me", email="d@t.com", message="delete this message")
        staff = self.staff_c()
        resp = staff.delete(f"/api/dashboard/messages/{m.id}/")
        self.assertEqual(resp.status_code, 204)
        self.assertEqual(ContactMessage.objects.count(), 0)
        resp = staff.delete("/api/dashboard/messages/999999/")
        self.assertEqual(resp.status_code, 404)

    def test_bulk_delete(self):
        ids = [
            ContactMessage.objects.create(
                name=f"Bulk {i}", email=f"b{i}@t.com",
                message=f"bulk message number {i}").id
            for i in range(3)
        ]
        staff = self.staff_c()
        resp = staff.post("/api/dashboard/messages/bulk-delete/",
                          {"ids": ids}, format="json")
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(resp.data["deleted"], 3)
        self.assertEqual(ContactMessage.objects.count(), 0)

    def test_bulk_delete_validation(self):
        staff = self.staff_c()
        for payload in ({}, {"ids": []}, {"ids": "1,2"},
                        {"ids": [True, False]}, {"ids": ["x"]}):
            resp = staff.post("/api/dashboard/messages/bulk-delete/",
                              payload, format="json")
            self.assertEqual(resp.status_code, 400, f"{payload} -> {resp.status_code}")
        # too many
        resp = staff.post("/api/dashboard/messages/bulk-delete/",
                          {"ids": list(range(201))}, format="json")
        self.assertEqual(resp.status_code, 400, resp.data)


# ---------------------------------------------------------------------
# SEARCH + XSS
# ---------------------------------------------------------------------


class SearchTests(Base):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        Product.objects.create(
            name="Butrint Ceramic Plate", slug="butrint-plate",
            category=cls.souvenirs, price=Decimal("25.00"), stock=5,
            sku="SKU-PLATE", description="Hand painted plate",
        )
        Product.objects.create(
            name="Gjirokastra Stone", slug="gjirokastra-stone",
            category=cls.souvenirs, price=Decimal("30.00"), stock=5,
            sku="SKU-STONE", description="Local stone souvenir",
        )

    def _names(self, resp):
        data = resp.data["results"] if isinstance(resp.data, dict) else resp.data
        return [p["name"] for p in data]

    def test_search_term(self):
        resp = self.guest().get("/api/products/", {"search": "plate"})
        self.assertEqual(resp.status_code, 200)
        self.assertIn("Butrint Ceramic Plate", self._names(resp))

    def test_search_empty_returns_everything(self):
        resp = self.guest().get("/api/products/", {"search": ""})
        self.assertEqual(resp.status_code, 200)
        data = resp.data["results"] if isinstance(resp.data, dict) else resp.data
        self.assertEqual(len(data), Product.objects.filter(is_active=True).count())

    def test_search_no_results(self):
        resp = self.guest().get("/api/products/", {"search": "zzznotfoundzz"})
        self.assertEqual(resp.status_code, 200)
        data = resp.data["results"] if isinstance(resp.data, dict) else resp.data
        self.assertEqual(len(data), 0)

    def test_search_special_characters(self):
        for term in ("<script>alert(1)</script>", "'; DROP TABLE--",
                     "%_%", "\\x00", "🙂 emoji"):
            resp = self.guest().get("/api/products/", {"search": term})
            self.assertEqual(resp.status_code, 200, f"{term!r} -> {resp.status_code}")

    def test_search_very_long_string(self):
        resp = self.guest().get("/api/products/", {"search": "a" * 2000})
        self.assertEqual(resp.status_code, 200)


class XssStorageTests(Base):
    """<script> payloads are stored as plain text and returned unexecuted."""

    SCRIPT = "<script>alert('pwned')</script>"

    def test_contact_message_stored_plain(self):
        resp = self.guest().post(
            "/api/contact/",
            {"name": "Xss Person", "email": "xss@test.com",
             "message": self.SCRIPT + " plus more text"},
            format="json",
        )
        self.assertEqual(resp.status_code, 201, resp.data)
        obj = ContactMessage.objects.get()
        self.assertEqual(obj.message, self.SCRIPT + " plus more text")
        # returned as data (JSON), not executed — literal tag in payload
        staff = self.staff_c()
        data = staff.get("/api/dashboard/messages/").data
        self.assertTrue(
            any(self.SCRIPT in m["message"] for m in data),
            f"script payload not returned as plain text: {data}")

    def test_register_name_stored_plain(self):
        resp = self.guest().post(
            "/api/auth/register/",
            {"full_name": self.SCRIPT + " Name", "email": "xss2@test.com",
             "password": "longenough1"},
            format="json",
        )
        self.assertEqual(resp.status_code, 201, resp.data)
        User = get_user_model()
        user = User.objects.get(email="xss2@test.com")
        self.assertIn("<script>", user.first_name)

    def test_order_note_stored_plain(self):
        g = self.guest()
        g.post("/api/cart/add/", {"product_id": Product.objects.create(
            name="X", slug="x-item",
            category=Category.objects.create(name="C", slug="c"),
            price=Decimal("5.00"), stock=2, sku="SKU-X").id,
            "quantity": 1}, format="json")
        with self.captureOnCommitCallbacks(execute=True):
            resp = g.post(
                "/api/checkout/",
                {"billing": billing(note=self.SCRIPT), "payment_method": "card"},
                format="json",
            )
        self.assertEqual(resp.status_code, 201, resp.data)
        order = Order.objects.get(pk=resp.data["id"])
        self.assertEqual(order.customer_note, self.SCRIPT)


# ---------------------------------------------------------------------
# STAFF PRODUCTS
# ---------------------------------------------------------------------


@override_settings(MEDIA_ROOT=TEST_MEDIA)
class StaffProductTests(Base):
    def test_create_edit_delete_product(self):
        staff = self.staff_c()
        resp = staff.post(
            "/api/dashboard/products/",
            {"name": "New Candle", "category_id": self.souvenirs.id,
             "price": "12.50", "stock": 7,
             "description": "Scented candle"},
            format="json",
        )
        self.assertEqual(resp.status_code, 201, resp.data)
        pid = resp.data["id"]
        self.assertEqual(resp.data["slug"], "new-candle")
        self.assertEqual(resp.data["sku"], "NEWCANDLE")
        # edit persists
        resp = staff.patch(f"/api/dashboard/products/{pid}/",
                           {"price": "14.00", "stock": 9}, format="json")
        self.assertEqual(resp.status_code, 200, resp.data)
        got = staff.get(f"/api/products/{pid}/")
        self.assertEqual(got.status_code, 200)
        self.assertEqual(Decimal(got.data["price"]), Decimal("14.00"))
        self.assertEqual(got.data["stock"], 9)
        # delete without order history
        resp = staff.delete(f"/api/dashboard/products/{pid}/")
        self.assertEqual(resp.status_code, 204)
        self.assertEqual(staff.get(f"/api/products/{pid}/").status_code, 404)

    def test_create_with_multiple_images_and_color_tags(self):
        staff = self.staff_c()
        resp = staff.post(
            "/api/dashboard/products/",
            {
                "name": "Tagged Shirt", "category_id": self.clothing.id,
                "price": "30.00", "stock": 4,
                "images": [tiny_png("one.png"), tiny_png("two.png")],
                "image_colors": ["White", "Black"],
            },
            format="multipart",
        )
        self.assertEqual(resp.status_code, 201, resp.data)
        images = resp.data["images"]
        self.assertEqual(len(images), 2)
        colors = sorted(i["color"] for i in images)
        self.assertEqual(colors, ["Black", "White"])
        primaries = [i for i in images if i["is_primary"]]
        self.assertEqual(len(primaries), 1, "exactly one primary image")

    def test_set_primary_image(self):
        staff = self.staff_c()
        resp = staff.post(
            "/api/dashboard/products/",
            {
                "name": "Prim Swap", "category_id": self.clothing.id,
                "price": "10.00", "stock": 2,
                "images": [tiny_png("p1.png"), tiny_png("p2.png")],
            },
            format="multipart",
        )
        pid = resp.data["id"]
        images = resp.data["images"]
        second = [i for i in images if not i["is_primary"]][0]
        resp = staff.patch(
            f"/api/dashboard/products/{pid}/images/{second['id']}/set-primary/")
        self.assertEqual(resp.status_code, 200, resp.data)
        primaries = [i for i in resp.data["images"] if i["is_primary"]]
        self.assertEqual(len(primaries), 1)
        self.assertEqual(primaries[0]["id"], second["id"])

    def test_delete_image_reassigns_primary(self):
        staff = self.staff_c()
        resp = staff.post(
            "/api/dashboard/products/",
            {
                "name": "Img Del", "category_id": self.clothing.id,
                "price": "10.00", "stock": 2,
                "images": [tiny_png("d1.png"), tiny_png("d2.png")],
            },
            format="multipart",
        )
        pid = resp.data["id"]
        primary = [i for i in resp.data["images"] if i["is_primary"]][0]
        resp = staff.delete(
            f"/api/dashboard/products/{pid}/images/{primary['id']}/")
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(len(resp.data["images"]), 1)
        self.assertTrue(resp.data["images"][0]["is_primary"])

    def test_delete_image_of_wrong_product_404(self):
        staff = self.staff_c()
        img = ProductImage.objects.create(product=self.shirt,
                                          image="products/x.png")
        resp = staff.delete(
            f"/api/dashboard/products/{self.mug.id}/images/{img.id}/")
        self.assertEqual(resp.status_code, 404)

    def test_delete_product_with_order_history_keeps_order_lines(self):
        staff = self.staff_c()
        order = Order.objects.create(
            user=self.user_a, total_amount=Decimal("25.00"),
            first_name="Keep", last_name="Lines", email="k@t.com")
        OrderItem.objects.create(order=order, product=self.shirt,
                                 color="White", size="M", quantity=2,
                                 unit_price=Decimal("25.00"))
        resp = staff.delete(
            f"/api/dashboard/products/{self.shirt.id}/")
        self.assertEqual(resp.status_code, 204)
        item = OrderItem.objects.get(order=order)
        self.assertIsNone(item.product)
        self.assertEqual(item.quantity, 2)
        self.assertEqual(item.unit_price, Decimal("25.00"))
        # order API still renders the line
        got = self.a().get(f"/api/orders/{order.id}/")
        self.assertEqual(got.status_code, 200, got.data)
        self.assertIsNone(got.data["items"][0]["product"])

    def test_add_stock_rejects_negative(self):
        staff = self.staff_c()
        resp = staff.patch(f"/api/dashboard/products/{self.shirt.id}/",
                           {"stock": -5}, format="json")
        self.assertEqual(resp.status_code, 400, resp.data)

    def test_add_stock_rejects_zero(self):
        # Spec: "add-stock rejects zero or negative".
        staff = self.staff_c()
        resp = staff.patch(f"/api/dashboard/products/{self.shirt.id}/",
                           {"stock": 0}, format="json")
        self.assertEqual(resp.status_code, 400,
                         "spec requires rejecting zero; see Needs my decision "
                         f"(current behaviour: {resp.status_code})")

    def test_add_stock_updates_immediately(self):
        staff = self.staff_c()
        resp = staff.patch(f"/api/dashboard/products/{self.shirt.id}/",
                           {"stock": 42}, format="json")
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(resp.data["stock"], 42)
        self.shirt.refresh_from_db()
        self.assertEqual(self.shirt.stock, 42)

    def test_inactive_product_hidden_from_public_list(self):
        Product.objects.create(
            name="Hidden Item", slug="hidden-item", category=self.souvenirs,
            price=Decimal("5.00"), stock=3, sku="SKU-HIDDEN", is_active=False)
        resp = self.guest().get("/api/products/", {"search": "Hidden"})
        data = resp.data["results"] if isinstance(resp.data, dict) else resp.data
        self.assertEqual(len(data), 0)
        staff = self.staff_c()
        resp = staff.get("/api/products/", {"search": "Hidden"})
        data = resp.data["results"] if isinstance(resp.data, dict) else resp.data
        self.assertEqual(len(data), 1)


# ---------------------------------------------------------------------
# REVENUE (hand-computed)
# ---------------------------------------------------------------------


class RevenueTests(Base):
    """Known orders, totals checked by hand.

    Fixtures:
      o1 2026-01-10 10:00  pending  25.00   (1x White Tee 25.00, Clothing)
      o2 2026-01-10 12:00  paid     30.00   (2x Tirana Mug 15.00, Souvenirs)
      o3 2026-01-10 13:00  cancelled 10.00  (excluded everywhere)
      o4 2026-01-11 23:59  shipped  60.00   (edge: last second of end day)
    """

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        from datetime import datetime
        from django.utils import timezone as tz

        def at(date_str, hour, minute=0):
            dt = datetime.strptime(f"{date_str} {hour:02d}:{minute:02d}",
                                   "%Y-%m-%d %H:%M")
            return tz.make_aware(dt)

        cls.o1 = Order.objects.create(
            user=cls.user_a, status="pending", total_amount=Decimal("25.00"),
            first_name="One", last_name="Buyer", email="one@t.com")
        OrderItem.objects.create(order=cls.o1, product=cls.shirt,
                                 unit_price=Decimal("25.00"), quantity=1)
        cls.o2 = Order.objects.create(
            user=cls.user_a, status="paid", total_amount=Decimal("30.00"),
            first_name="Two", last_name="Buyer", email="two@t.com")
        OrderItem.objects.create(order=cls.o2, product=cls.mug,
                                 unit_price=Decimal("15.00"), quantity=2)
        cls.o3 = Order.objects.create(
            user=cls.user_a, status="cancelled", total_amount=Decimal("10.00"),
            first_name="Three", last_name="Buyer", email="three@t.com")
        OrderItem.objects.create(order=cls.o3, product=cls.shirt,
                                 unit_price=Decimal("10.00"), quantity=1)
        cls.o4 = Order.objects.create(
            user=cls.user_b, status="shipped", total_amount=Decimal("60.00"),
            first_name="Four", last_name="Buyer", email="four@t.com")

        Order.objects.filter(pk=cls.o1.pk).update(created_at=at("2026-01-10", 10))
        Order.objects.filter(pk=cls.o2.pk).update(created_at=at("2026-01-10", 12))
        Order.objects.filter(pk=cls.o3.pk).update(created_at=at("2026-01-10", 13))
        Order.objects.filter(pk=cls.o4.pk).update(created_at=at("2026-01-11", 23, 59))

    def revenue(self, start, end):
        resp = self.staff_c().get(
            "/api/dashboard/revenue/", {"start": start, "end": end})
        return resp

    def test_single_day_totals_hand_computed(self):
        resp = self.revenue("2026-01-10", "2026-01-10")
        self.assertEqual(resp.status_code, 200, resp.data)
        cur = resp.data["current"]
        # cancelled excluded: 25.00 + 30.00 = 55.00, avg 55/2 = 27.50
        self.assertEqual(Decimal(cur["revenue"]), Decimal("55.00"))
        self.assertEqual(cur["orders"], 2)
        self.assertEqual(Decimal(cur["average"]), Decimal("27.50"))
        self.assertEqual(cur["items_sold"], 3)  # 1 tee + 2 mugs

    def test_end_date_inclusive_last_second(self):
        resp = self.revenue("2026-01-10", "2026-01-11")
        self.assertEqual(resp.status_code, 200, resp.data)
        cur = resp.data["current"]
        # 25 + 30 + 60 = 115.00 (cancelled 10.00 excluded), 3 orders
        self.assertEqual(Decimal(cur["revenue"]), Decimal("115.00"))
        self.assertEqual(cur["orders"], 3)
        self.assertEqual(Decimal(cur["average"]), Decimal("38.33"))

    def test_cancelled_order_excluded_from_series_and_list(self):
        resp = self.revenue("2026-01-10", "2026-01-11")
        series_total = sum(Decimal(s["revenue"]) for s in resp.data["series"])
        self.assertEqual(series_total, Decimal("115.00"))
        ids = [o["id"] for o in resp.data["orders"]]
        self.assertNotIn(self.o3.id, ids)
        self.assertIn(self.o1.id, ids)
        self.assertIn(self.o4.id, ids)

    def test_revenue_equals_sum_of_listed_orders(self):
        resp = self.revenue("2026-01-10", "2026-01-11")
        listed = sum(Decimal(o["total_amount"]) for o in resp.data["orders"])
        self.assertEqual(Decimal(resp.data["current"]["revenue"]), listed)

    def test_series_matches_daily_split(self):
        resp = self.revenue("2026-01-10", "2026-01-11")
        by_period = {s["period"]: Decimal(s["revenue"])
                     for s in resp.data["series"]}
        self.assertEqual(by_period["2026-01-10"], Decimal("55.00"))
        self.assertEqual(by_period["2026-01-11"], Decimal("60.00"))

    def test_by_category_and_top_products_hand_computed(self):
        resp = self.revenue("2026-01-10", "2026-01-11")
        cats = {c["category"]: Decimal(c["revenue"])
                for c in resp.data["by_category"]}
        # cancelled o3's item excluded; only o1 tee (Clothing 25.00)
        # and o2 mugs (Souvenirs 30.00)
        self.assertEqual(cats.get("Clothing"), Decimal("25.00"))
        self.assertEqual(cats.get("Souvenirs"), Decimal("30.00"))
        self.assertNotIn(None, cats)
        tops = {t["name"]: t for t in resp.data["top_products"]}
        self.assertEqual(Decimal(tops["Tirana Mug"]["revenue"]), Decimal("30.00"))
        self.assertEqual(tops["Tirana Mug"]["quantity"], 2)
        self.assertEqual(Decimal(tops["White Tee"]["revenue"]), Decimal("25.00"))
        self.assertEqual(tops["White Tee"]["quantity"], 1)

    def test_empty_range_returns_zeros(self):
        resp = self.revenue("2027-05-01", "2027-05-01")
        self.assertEqual(resp.status_code, 200, resp.data)
        cur = resp.data["current"]
        self.assertEqual(Decimal(cur["revenue"]), Decimal("0.00"))
        self.assertEqual(cur["orders"], 0)
        self.assertEqual(Decimal(cur["average"]), Decimal("0"))
        self.assertEqual(resp.data["series"],
                         [{"period": "2027-05-01", "revenue": "0.00"}])
        self.assertEqual(resp.data["orders"], [])

    def test_previous_period_zero_does_not_divide_by_zero(self):
        # range whose previous period has no orders
        resp = self.revenue("2026-01-10", "2026-01-10")
        self.assertEqual(resp.status_code, 200, resp.data)
        prev = resp.data["previous"]
        self.assertEqual(prev["orders"], 0)
        self.assertEqual(Decimal(prev["average"]), Decimal("0"))
        self.assertEqual(Decimal(prev["revenue"]), Decimal("0.00"))

    def test_invalid_and_reversed_dates_400(self):
        cases = [
            {"start": "not-a-date", "end": "2026-01-10"},
            {"start": "2026-01-10", "end": "2026-99-99"},
            {"start": "2026-01-11", "end": "2026-01-10"},  # reversed
            {"start": "2026-01-10"},                        # missing end
            {"end": "2026-01-10"},                          # missing start
            {},                                             # both missing
        ]
        for params in cases:
            resp = self.staff_c().get("/api/dashboard/revenue/", params)
            self.assertEqual(resp.status_code, 400,
                             f"{params} -> {resp.status_code}")

    def test_revenue_permission_matrix(self):
        url = "/api/dashboard/revenue/?start=2026-01-10&end=2026-01-11"
        self.assertEqual(self.guest().get(url).status_code, 401)
        self.assertEqual(self.a().get(url).status_code, 403)
        self.assertEqual(self.staff_c().get(url).status_code, 200)


# ---------------------------------------------------------------------
# ORDER WORKFLOW (mark done / undo)
# ---------------------------------------------------------------------


class OrderWorkflowTests(Base):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.order = Order.objects.create(
            user=cls.user_a, total_amount=Decimal("25.00"),
            first_name="Work", last_name="Flow", email="wf@t.com")
        OrderItem.objects.create(order=cls.order, product=cls.shirt,
                                 unit_price=Decimal("25.00"), quantity=1)

    def test_mark_done_and_undo_persist(self):
        staff = self.staff_c()
        url = f"/api/dashboard/orders/{self.order.id}/"
        resp = staff.patch(url, {"is_done": True}, format="json")
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertTrue(resp.data["is_done"])
        self.assertIsNotNone(resp.data["done_at"])
        # persists: fresh read
        got = staff.get("/api/dashboard/orders/")
        row = [o for o in got.data if o["id"] == self.order.id][0]
        self.assertTrue(row["is_done"])
        # undo
        resp = staff.patch(url, {"is_done": False}, format="json")
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertFalse(resp.data["is_done"])
        self.assertIsNone(resp.data["done_at"])
        got = staff.get("/api/dashboard/orders/")
        row = [o for o in got.data if o["id"] == self.order.id][0]
        self.assertFalse(row["is_done"])

    def test_mark_done_string_boolean_accepted(self):
        staff = self.staff_c()
        url = f"/api/dashboard/orders/{self.order.id}/"
        resp = staff.patch(url, {"is_done": "true"}, format="json")
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertTrue(resp.data["is_done"])

    def test_mark_done_invalid_payloads_400(self):
        staff = self.staff_c()
        url = f"/api/dashboard/orders/{self.order.id}/"
        resp = staff.patch(url, {"is_done": "maybe"}, format="json")
        self.assertEqual(resp.status_code, 400, resp.data)
        resp = staff.patch(url, {"status": "done"}, format="json")
        self.assertEqual(resp.status_code, 400, resp.data)

    def test_mark_done_nonexistent_404(self):
        resp = self.staff_c().patch("/api/dashboard/orders/999999/",
                                    {"is_done": True}, format="json")
        self.assertEqual(resp.status_code, 404)

    def test_dashboard_orders_returns_all_orders_with_csv_source_fields(self):
        # The Orders CSV is built client-side from these rows — verify the
        # source data (number, name, totals) the export uses.
        staff = self.staff_c()
        resp = staff.get("/api/dashboard/orders/")
        self.assertEqual(resp.status_code, 200, resp.data)
        row = [o for o in resp.data if o["id"] == self.order.id][0]
        self.assertEqual(row["first_name"], "Work")
        self.assertEqual(row["last_name"], "Flow")
        self.assertEqual(Decimal(row["total_amount"]), Decimal("25.00"))
        self.assertEqual(row["items"][0]["quantity"], 1)
        # line total = unit price x quantity
        line = row["items"][0]
        self.assertEqual(
            Decimal(line["unit_price"]) * line["quantity"],
            Decimal("25.00"))
