from django.core.management.base import BaseCommand
from store.models import Category, Product, ProductImage
import os
from django.conf import settings


class Command(BaseCommand):
    help = "Seed Marigo souvenir categories and 8 products with images."

    def handle(self, *args, **options):
        categories_data = [
            {
                "name": "Souvenirs",
                "slug": "souvenirs",
                "has_color_options": False,
                "has_size_options": False,
            },
            {
                "name": "Clothing",
                "slug": "clothing",
                "has_color_options": True,
                "has_size_options": True,
            },
            {
                "name": "Accessories",
                "slug": "accessories",
                "has_color_options": False,
                "has_size_options": False,
            },
            {
                "name": "Stationary",
                "slug": "stationary",
                "has_color_options": False,
                "has_size_options": False,
            },
        ]
        categories = {}
        for data in categories_data:
            cat, created = Category.objects.get_or_create(
                slug=data["slug"],
                defaults={
                    "name": data["name"],
                    "has_color_options": data.get("has_color_options", False),
                    "has_size_options": data.get("has_size_options", False),
                },
            )
            # Re-run of seed: lock Clothing-only color/size options (overrides any drift).
            wanted_color = data.get("has_color_options", False)
            wanted_size = data.get("has_size_options", False)
            if not created and (
                cat.has_color_options != wanted_color
                or cat.has_size_options != wanted_size
            ):
                cat.has_color_options = wanted_color
                cat.has_size_options = wanted_size
                cat.save(update_fields=["has_color_options", "has_size_options"])
            categories[data["slug"]] = cat
            self.stdout.write(
                f"{'Created' if created else 'Exists'} category: {cat.name} "
                f"(has_color_options={cat.has_color_options}, "
                f"has_size_options={cat.has_size_options})"
            )

        products_data = [
            {
                "name": "White Printed T-shirt",
                "slug": "white-printed-tshirt",
                "description": "Classic white cotton t-shirt with colorful Albania print.",
                "category": "clothing",
                "price": "25.00",
                "stock": 100,
                "sku": "CLOTH-001",
                "image_file": "Hanging_T-Shirt_Mockup 8 1 (1).png",
                "is_best_seller": True,
            },
            {
                "name": "Butrint Ceramic Plate",
                "slug": "butrint-ceramic-plate",
                "description": "Hand-painted ceramic plate featuring Butrint motifs.",
                "category": "souvenirs",
                "price": "25.00",
                "stock": 50,
                "sku": "SOUV-001",
                "image_file": "Hanging_T-Shirt_Mockup 8 7.png",
                "is_best_seller": True,
            },
            {
                "name": "Black Printed T-shirt",
                "slug": "black-printed-tshirt",
                "description": "Premium black cotton t-shirt with heritage print.",
                "category": "clothing",
                "price": "25.00",
                "stock": 80,
                "sku": "CLOTH-002",
                "image_file": "Hanging_T-Shirt_Mockup 8 8.png",
                "is_best_seller": False,
            },
            {
                "name": "Butrint Decorative Plate",
                "slug": "butrint-decorative-plate",
                "description": "Decorative plate with traditional Butrint pattern.",
                "category": "souvenirs",
                "price": "25.00",
                "stock": 40,
                "sku": "SOUV-002",
                "image_file": "Hanging_T-Shirt_Mockup 8 9.png",
                "is_best_seller": False,
            },
            {
                "name": "Albania T-shirt White",
                "slug": "albania-tshirt-white",
                "description": "White t-shirt with Albania flag emblem.",
                "category": "clothing",
                "price": "25.00",
                "stock": 120,
                "sku": "CLOTH-003",
                "image_file": "Hanging_T-Shirt_Mockup 8 10.png",
                "is_best_seller": True,
            },
            {
                "name": "Tirana Souvenir Mug",
                "slug": "tirana-souvenir-mug",
                "description": "Ceramic mug with Tirana city artwork.",
                "category": "souvenirs",
                "price": "15.00",
                "stock": 60,
                "sku": "SOUV-003",
                "image_file": "Hanging_T-Shirt_Mockup 8 11.png",
                "is_best_seller": False,
            },
            {
                "name": "Heritage Tote Bag",
                "slug": "heritage-tote-bag",
                "description": "Canvas tote bag with Gjirokastra design.",
                "category": "accessories",
                "price": "20.00",
                "stock": 70,
                "sku": "ACC-001",
                "image_file": "Hanging_T-Shirt_Mockup 8 12.png",
                "is_best_seller": True,
            },
            {
                "name": "Albania Notebook Set",
                "slug": "albania-notebook-set",
                "description": "Set of 3 notebooks with Albanian heritage covers.",
                "category": "stationary",
                "price": "12.00",
                "stock": 90,
                "sku": "STAT-001",
                "image_file": "Hanging_T-Shirt_Mockup 8 13.png",
                "is_best_seller": False,
            },
        ]

        for p in products_data:
            product, created = Product.objects.get_or_create(
                slug=p["slug"],
                defaults={
                    "name": p["name"],
                    "description": p["description"],
                    "category": categories[p["category"]],
                    "price": p["price"],
                    "stock": p["stock"],
                    "sku": p["sku"],
                    "is_active": True,
                    "is_best_seller": p.get("is_best_seller", False),
                },
            )
            if not created and "is_best_seller" in p:
                if product.is_best_seller != p["is_best_seller"]:
                    product.is_best_seller = p["is_best_seller"]
                    product.save(update_fields=["is_best_seller"])
            self.stdout.write(
                f"{'Created' if created else 'Exists'} product: {product.name}"
            )

            # Ensure a primary image exists on disk — also repairs products that
            # already have a ProductImage row whose file was never saved/was lost.
            if p.get("image_file"):
                img_path = os.path.join(
                    settings.BASE_DIR, "frontend", "src", "assets", p["image_file"]
                )
                needs_image = True
                existing = product.images.filter(is_primary=True).first()
                if existing and existing.image:
                    abs_existing = existing.image.path
                    if os.path.isfile(abs_existing) and os.path.getsize(abs_existing) > 0:
                        needs_image = False
                if needs_image and os.path.exists(img_path):
                    with open(img_path, "rb") as f:
                        from django.core.files.base import ContentFile

                        content = ContentFile(f.read())
                        img_name = os.path.basename(p["image_file"])
                        if existing:
                            # Replace dangling path with a real file copy.
                            existing.image.save(img_name, content, save=True)
                            self.stdout.write(
                                f"  -> Repaired image: {existing.image.name}"
                            )
                        else:
                            pi = ProductImage(
                                product=product,
                                alt_text=p["name"],
                                is_primary=True,
                            )
                            pi.image.save(img_name, content, save=True)
                            self.stdout.write(f"  -> Added image: {img_name}")
                elif needs_image:
                    self.stdout.write(
                        self.style.WARNING(f"  -> Image not found: {img_path}")
                    )

        self.stdout.write(self.style.SUCCESS("Marigo seed data loaded."))
