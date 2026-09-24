from decimal import Decimal

from django.contrib.auth import get_user_model
from django.utils.text import slugify
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
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

User = get_user_model()


# ---------- Category ----------


class CategorySerializer(serializers.ModelSerializer):
    children = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Category
        fields = [
            "id",
            "name",
            "slug",
            "parent",
            "children",
            "has_color_options",
            "has_size_options",
            "created_at",
        ]

    def get_children(self, obj):
        return CategorySerializer(obj.children.all(), many=True).data


# ---------- Product ----------


class ProductImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductImage
        fields = [
            "id",
            "product",
            "image",
            "alt_text",
            "is_primary",
            "position",
            "color",
        ]


class ProductListSerializer(serializers.ModelSerializer):
    primary_image = serializers.SerializerMethodField()
    category_name = serializers.CharField(source="category.name", read_only=True)
    # Flat copies so Quick View (list payload) can enable/disable color/size
    # without a detail fetch.
    has_color_options = serializers.BooleanField(
        source="category.has_color_options", read_only=True
    )
    has_size_options = serializers.BooleanField(
        source="category.has_size_options", read_only=True
    )

    class Meta:
        model = Product
        fields = ["id", "name", "slug", "price", "stock", "is_best_seller", "category", "category_name", "has_color_options", "has_size_options", "primary_image"]

    def get_primary_image(self, obj):
        img = obj.images.filter(is_primary=True).first() or obj.images.first()
        if not img:
            return None
        request = self.context.get("request")
        url = img.image.url if img.image else None
        if url and request:
            return request.build_absolute_uri(url)
        return url


class ProductDetailSerializer(serializers.ModelSerializer):
    images = ProductImageSerializer(many=True, read_only=True)
    category = CategorySerializer(read_only=True)
    category_id = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(), source="category", write_only=True
    )

    class Meta:
        model = Product
        fields = [
            "id",
            "name",
            "slug",
            "description",
            "category",
            "category_id",
            "price",
            "stock",
            "sku",
            "is_active",
            "is_best_seller",
            "images",
            "created_at",
            "updated_at",
        ]


class DashboardProductSerializer(serializers.ModelSerializer):
    """Staff dashboard product write/read — multi-image multipart upload."""

    category = CategorySerializer(read_only=True)
    category_id = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(),
        source="category",
        write_only=True,
        required=True,
    )
    images = ProductImageSerializer(many=True, read_only=True)
    primary_image = serializers.SerializerMethodField(read_only=True)
    # Legacy single-file field (still accepted); multi-upload uses FILES.getlist("images").
    image = serializers.ImageField(write_only=True, required=False)
    primary_image_id = serializers.IntegerField(
        write_only=True, required=False, allow_null=True
    )
    primary_new_index = serializers.IntegerField(
        write_only=True, required=False, allow_null=True
    )

    class Meta:
        model = Product
        fields = [
            "id",
            "name",
            "slug",
            "description",
            "category",
            "category_id",
            "price",
            "stock",
            "sku",
            "is_active",
            "is_best_seller",
            "images",
            "primary_image",
            "image",
            "primary_image_id",
            "primary_new_index",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["slug", "sku", "created_at", "updated_at"]

    def get_primary_image(self, obj):
        img = obj.images.filter(is_primary=True).first() or obj.images.first()
        if not img:
            return None
        request = self.context.get("request")
        url = img.image.url if img.image else None
        if url and request:
            return request.build_absolute_uri(url)
        return url

    @staticmethod
    def _unique_slug(name):
        base = slugify(name) or "product"
        slug = base
        n = 1
        while Product.objects.filter(slug=slug).exists():
            n += 1
            slug = f"{base}-{n}"
        return slug

    @staticmethod
    def _unique_sku(name):
        base = (slugify(name).upper().replace("-", "") or "PROD")[:40]
        sku = base
        n = 1
        while Product.objects.filter(sku=sku).exists():
            n += 1
            sku = f"{base}-{n}"
        return sku

    def validate_price(self, value):
        if value is not None and value <= 0:
            raise serializers.ValidationError("Price must be a positive number.")
        return value

    def validate_stock(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError(
                "Stock quantity cannot be negative."
            )
        return value

    @staticmethod
    def _align_request_colors(count, request_colors):
        """Map POST `image_colors` (aligned with FILES `images`) onto created rows."""
        colors = []
        for i in range(count):
            raw = request_colors[i] if i < len(request_colors) else ""
            colors.append((raw or "").strip()[:100])
        return colors

    def _attach_images(
        self,
        product,
        image_files,
        primary_id=None,
        primary_new_index=None,
        image_colors=None,
    ):
        """Append uploaded files as ProductImage rows and resolve the primary."""
        from django.db.models import Max

        last = product.images.aggregate(m=Max("position"))["m"]
        next_pos = (last or 0) + 1
        created = []
        for i, f in enumerate(image_files):
            color = image_colors[i] if image_colors and i < len(image_colors) else ""
            img = ProductImage(
                product=product,
                is_primary=False,
                alt_text=product.name,
                position=next_pos,
                color=color or "",
            )
            img.image.save(f.name, f, save=True)
            created.append(img)
            next_pos += 1

        def make_primary(target):
            product.images.filter(is_primary=True).exclude(pk=target.pk).update(
                is_primary=False
            )
            if not target.is_primary:
                target.is_primary = True
                target.save(update_fields=["is_primary"])

        if primary_id:
            target = product.images.filter(pk=primary_id).first()
            if target:
                make_primary(target)
                return
        if primary_new_index is not None and 0 <= primary_new_index < len(created):
            make_primary(created[primary_new_index])
            return
        if not product.images.filter(is_primary=True).exists():
            first = product.images.order_by("position", "id").first()
            if first:
                make_primary(first)

    @staticmethod
    def _pop_image_opts(validated_data):
        image_files = []
        single = validated_data.pop("image", None)
        if single:
            image_files.append(single)
        primary_id = validated_data.pop("primary_image_id", None)
        primary_new_index = validated_data.pop("primary_new_index", None)
        return image_files, primary_id, primary_new_index

    @staticmethod
    def _request_images(context):
        """Return (files, colors, color_updates) from multipart create/update."""
        request = context.get("request")
        if request is None:
            return [], [], {}
        files = list(request.FILES.getlist("images"))
        colors = list(request.POST.getlist("image_colors"))
        updates = {}
        raw_updates = request.POST.get("image_color_updates")
        if raw_updates:
            try:
                import json

                parsed = json.loads(raw_updates)
                if isinstance(parsed, dict):
                    updates = parsed
            except (ValueError, TypeError):
                updates = {}
        return files, colors, updates

    @staticmethod
    def _apply_color_updates(product, updates):
        """PATCH-style {image_id: color} map from the dashboard form."""
        if not updates:
            return
        for key, value in updates.items():
            try:
                image_id = int(key)
            except (TypeError, ValueError):
                continue
            if not product.images.filter(pk=image_id).exists():
                continue
            color = ("" if value is None else str(value)).strip()[:100]
            product.images.filter(pk=image_id).update(color=color)

    def create(self, validated_data):
        image_files, primary_id, primary_new_index = self._pop_image_opts(
            validated_data
        )
        req_files, req_colors, _updates = self._request_images(self.context)
        # Legacy single `image` (if any) is prepended — no parallel color entry.
        if image_files:
            image_files = image_files + req_files
            request_colors = [""] + list(req_colors)
        else:
            image_files = req_files
            request_colors = list(req_colors)
        if not validated_data.get("slug"):
            validated_data["slug"] = self._unique_slug(validated_data.get("name", ""))
        if not validated_data.get("sku"):
            validated_data["sku"] = self._unique_sku(validated_data.get("name", ""))
        # slug/sku are in read_only_fields — pop from validated is enough;
        # set them explicitly before create since they're not in validated_data.
        product = Product.objects.create(**validated_data)
        self._attach_images(
            product,
            image_files,
            primary_id=primary_id,
            primary_new_index=primary_new_index,
            image_colors=self._align_request_colors(len(image_files), request_colors),
        )
        return product

    def update(self, instance, validated_data):
        image_files, primary_id, primary_new_index = self._pop_image_opts(
            validated_data
        )
        req_files, req_colors, color_updates = self._request_images(self.context)
        if image_files:
            image_files = image_files + req_files
            request_colors = [""] + list(req_colors)
        else:
            image_files = req_files
            request_colors = list(req_colors)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        self._apply_color_updates(instance, color_updates)
        self._attach_images(
            instance,
            image_files,
            primary_id=primary_id,
            primary_new_index=primary_new_index,
            image_colors=self._align_request_colors(len(image_files), request_colors),
        )
        return instance


# ---------- Cart ----------


class CartItemSerializer(serializers.ModelSerializer):
    product = ProductListSerializer(read_only=True)
    product_id = serializers.PrimaryKeyRelatedField(
        queryset=Product.objects.all(), source="product", write_only=True
    )
    line_total = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = CartItem
        fields = [
            "id",
            "product",
            "product_id",
            "color",
            "size",
            "quantity",
            "unit_price",
            "line_total",
        ]
        read_only_fields = ["unit_price"]

    def get_line_total(self, obj):
        return str(obj.unit_price * obj.quantity)


class CartSerializer(serializers.ModelSerializer):
    items = CartItemSerializer(many=True, read_only=True)
    total_amount = serializers.SerializerMethodField(read_only=True)
    total_items = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Cart
        fields = ["id", "user", "session_key", "items", "total_items", "total_amount", "created_at"]

    def _compute_totals(self, obj):
        """Single pass over prefetched items to compute both totals."""
        total_price = Decimal("0")
        total_qty = 0
        for item in obj.items.all():
            total_price += item.unit_price * item.quantity
            total_qty += item.quantity
        return str(total_price), total_qty

    def get_total_amount(self, obj):
        amount, _ = self._compute_totals(obj)
        return amount

    def get_total_items(self, obj):
        _, qty = self._compute_totals(obj)
        return qty


# ---------- Wishlist ----------


class WishlistSerializer(serializers.ModelSerializer):
    product = ProductListSerializer(read_only=True)
    product_id = serializers.PrimaryKeyRelatedField(
        queryset=Product.objects.all(), source="product", write_only=True
    )

    class Meta:
        model = Wishlist
        fields = ["id", "product", "product_id", "created_at"]
        read_only_fields = ["created_at"]


# ---------- Contact ----------


class ContactMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContactMessage
        fields = ["id", "name", "email", "message", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate_name(self, value):
        value = " ".join(value.split())
        if len(value) < 2:
            raise serializers.ValidationError("Name is too short.")
        return value

    def validate_email(self, value):
        return value.strip().lower()

    def validate_message(self, value):
        value = value.strip()
        if len(value) < 10:
            raise serializers.ValidationError(
                "Message is too short (min 10 characters)."
            )
        if len(value) > 5000:
            raise serializers.ValidationError(
                "Message is too long (max 5000 characters)."
            )
        return value


# ---------- Address ----------


class AddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = Address
        fields = [
            "id",
            "user",
            "full_name",
            "line1",
            "line2",
            "city",
            "state",
            "postal_code",
            "country",
            "phone",
            "created_at",
        ]
        read_only_fields = ["user"]

    def validate_phone(self, value):
        if not value:
            return value
        # Digits only — reject non-numeric input from any client (no leading +).
        if not value.isdigit():
            raise serializers.ValidationError(
                "Phone number must contain digits only."
            )
        if len(value) < 7:
            raise serializers.ValidationError(
                "Phone number must be at least 7 digits."
            )
        return value


# ---------- Order ----------


class OrderItemSerializer(serializers.ModelSerializer):
    product = ProductListSerializer(read_only=True)

    class Meta:
        model = OrderItem
        fields = ["id", "product", "color", "size", "quantity", "unit_price"]


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    shipping_address = AddressSerializer(read_only=True)
    shipping_address_id = serializers.PrimaryKeyRelatedField(
        queryset=Address.objects.all(),
        source="shipping_address",
        write_only=True,
        required=False,
        allow_null=True,
    )

    class Meta:
        model = Order
        fields = [
            "id",
            "user",
            "status",
            "payment_method",
            "customer_note",
            "total_amount",
            "first_name",
            "last_name",
            "country",
            "city",
            "zip_code",
            "address",
            "phone",
            "email",
            "recipient_address",
            "shipping_address",
            "shipping_address_id",
            "items",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["user", "total_amount"]


# ---------- Auth ----------


class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Accept {email, password}; resolve email to the internal username."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Present "email" instead of "username" (internal USERNAME_FIELD).
        if self.username_field in self.fields:
            self.fields.pop(self.username_field)
        self.fields["email"] = serializers.EmailField()

    def validate(self, attrs):
        email = attrs.pop("email", None)
        # Map email -> username so SimpleJWT's parent validate/authenticate runs unchanged.
        user = None
        if email:
            user = User.objects.filter(email__iexact=email).first()
        attrs[self.username_field] = user.get_username() if user else "__no_such_user__"
        return super().validate(attrs)


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    full_name = serializers.CharField(write_only=True, max_length=150)
    email = serializers.EmailField(required=True)

    class Meta:
        model = User
        fields = ["id", "full_name", "email", "password"]

    def validate_email(self, value):
        value = value.strip()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError(
                "An account with this email already exists."
            )
        return value

    def validate_full_name(self, value):
        value = " ".join(value.split())
        if len(value) < 2:
            raise serializers.ValidationError("Name is too short.")
        return value

    @staticmethod
    def _generate_username(email):
        """Derive a valid unique username from the email local part."""
        import re

        local = email.split("@", 1)[0]
        base = re.sub(r"[^\w.@+-]", "", local, flags=re.UNICODE).strip("._-")
        if not base:
            base = "user"
        base = base[:140]
        username = base
        n = 1
        while User.objects.filter(username=username).exists():
            n += 1
            username = f"{base}{n}"[:150]
        return username

    def create(self, validated_data):
        full_name = validated_data.pop("full_name")
        email = validated_data["email"]
        parts = full_name.split(None, 1)
        first = parts[0][:150]
        last = parts[1][:150] if len(parts) > 1 else ""
        return User.objects.create_user(
            username=self._generate_username(email),
            email=email,
            password=validated_data["password"],
            first_name=first,
            last_name=last,
        )


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "is_staff",
            "date_joined",
        ]
