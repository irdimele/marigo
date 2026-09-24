from django.contrib import admin
from .models import (
    Category,
    Product,
    ProductImage,
    Cart,
    CartItem,
    Order,
    OrderItem,
    Address,
    Wishlist,
    ContactMessage,
)


class ProductImageInline(admin.TabularInline):
    model = ProductImage
    extra = 1


class CartItemInline(admin.TabularInline):
    model = CartItem
    extra = 0
    fields = ("product", "color", "size", "quantity", "unit_price")


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    fields = ("product", "color", "size", "quantity", "unit_price")


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "name",
        "slug",
        "parent",
        "has_color_options",
        "has_size_options",
        "created_at",
    )
    search_fields = ("name", "slug")
    list_filter = ("parent", "has_color_options", "has_size_options")
    prepopulated_fields = {"slug": ("name",)}


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "slug", "category", "price", "stock", "sku", "is_active", "is_best_seller")
    search_fields = ("name", "slug", "sku", "description")
    list_filter = ("category", "is_active", "is_best_seller")
    prepopulated_fields = {"slug": ("name",)}
    inlines = [ProductImageInline]


@admin.register(ProductImage)
class ProductImageAdmin(admin.ModelAdmin):
    list_display = ("id", "product", "color", "is_primary", "position", "alt_text")
    search_fields = ("product__name", "alt_text", "color")
    list_filter = ("is_primary", "color")


@admin.register(Cart)
class CartAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "session_key", "created_at")
    search_fields = ("user__username", "session_key")
    inlines = [CartItemInline]


@admin.register(CartItem)
class CartItemAdmin(admin.ModelAdmin):
    list_display = ("id", "cart", "product", "color", "size", "quantity", "unit_price")
    search_fields = ("product__name", "color", "size")


@admin.register(Address)
class AddressAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "full_name", "city", "country", "postal_code")
    search_fields = ("full_name", "line1", "city", "postal_code", "user__username")


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "user",
        "status",
        "payment_method",
        "first_name",
        "last_name",
        "email",
        "phone",
        "city",
        "country",
        "zip_code",
        "address",
        "total_amount",
        "created_at",
    )
    search_fields = (
        "user__username",
        "user__email",
        "status",
        "first_name",
        "last_name",
        "email",
        "phone",
        "city",
        "zip_code",
        "address",
    )
    list_filter = ("status", "payment_method")
    fieldsets = (
        (None, {"fields": ("user", "status", "payment_method", "total_amount", "customer_note")}),
        (
            "Billing details",
            {
                "fields": (
                    "first_name",
                    "last_name",
                    "email",
                    "phone",
                    "address",
                    "city",
                    "zip_code",
                    "country",
                )
            },
        ),
        (
            "Shipping",
            {
                "fields": (
                    "recipient_address",
                    "shipping_address",
                )
            },
        ),
        ("Timestamps", {"fields": ("created_at", "updated_at")}),
    )
    readonly_fields = ("created_at", "updated_at")
    inlines = [OrderItemInline]


@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
    list_display = ("id", "order", "product", "color", "size", "quantity", "unit_price")
    search_fields = ("product__name", "color", "size")


@admin.register(Wishlist)
class WishlistAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "product", "created_at")
    search_fields = ("user__username", "user__email", "product__name")
    list_filter = ("created_at",)


@admin.register(ContactMessage)
class ContactMessageAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "email", "created_at")
    search_fields = ("name", "email", "message")
    readonly_fields = ("name", "email", "message", "created_at")
