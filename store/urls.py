from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .serializers import EmailTokenObtainPairSerializer
from .views import (
    AddressViewSet,
    CartAddView,
    CartDetailView,
    CartItemUpdateDeleteView,
    CategoryViewSet,
    CheckoutView,
    ContactCreateView,
    DashboardMessagesView,
    DashboardOrdersView,
    DashboardProductViewSet,
    MeView,
    OrderViewSet,
    ProductViewSet,
    RegisterView,
    WishlistItemView,
    WishlistView,
)


class EmailTokenObtainPairView(TokenObtainPairView):
    serializer_class = EmailTokenObtainPairSerializer

router = DefaultRouter()
router.register(r"categories", CategoryViewSet, basename="category")
router.register(r"products", ProductViewSet, basename="product")
router.register(r"orders", OrderViewSet, basename="order")
router.register(r"addresses", AddressViewSet, basename="address")
router.register(
    r"dashboard/products",
    DashboardProductViewSet,
    basename="dashboard-product",
)

urlpatterns = [
    # JWT (login via email + password)
    path("token/", EmailTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    # Auth
    path("auth/register/", RegisterView.as_view(), name="auth-register"),
    path("auth/me/", MeView.as_view(), name="auth-me"),
    # Cart
    path("cart/", CartDetailView.as_view(), name="cart-detail"),
    path("cart/add/", CartAddView.as_view(), name="cart-add"),
    path("cart/items/<int:pk>/", CartItemUpdateDeleteView.as_view(), name="cart-item"),
    # Checkout
    path("checkout/", CheckoutView.as_view(), name="checkout"),
    # Wishlist
    path("wishlist/", WishlistView.as_view(), name="wishlist"),
    path(
        "wishlist/<int:product_id>/",
        WishlistItemView.as_view(),
        name="wishlist-item",
    ),
    # Contact
    path("contact/", ContactCreateView.as_view(), name="contact"),
    # Dashboard (staff only)
    path("dashboard/orders/", DashboardOrdersView.as_view(), name="dashboard-orders"),
    path(
        "dashboard/messages/",
        DashboardMessagesView.as_view(),
        name="dashboard-messages",
    ),
    # Router (categories, products, orders, addresses)
    path("", include(router.urls)),
]
