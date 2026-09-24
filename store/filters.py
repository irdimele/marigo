import django_filters
from .models import Product


class ProductFilter(django_filters.FilterSet):
    # ?category=<id> (also supports ?category__slug=)
    min_price = django_filters.NumberFilter(field_name="price", lookup_expr="gte")
    max_price = django_filters.NumberFilter(field_name="price", lookup_expr="lte")

    class Meta:
        model = Product
        fields = {
            "category": ["exact"],
            "category__slug": ["exact"],
            "is_active": ["exact"],
            "is_best_seller": ["exact"],
            "price": ["gte", "lte", "exact"],
        }
