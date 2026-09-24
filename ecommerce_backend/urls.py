from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path


def api_root_info(request):
    return JsonResponse(
        {
            "status": "ok",
            "endpoints": [
                "/api/products/",
                "/api/categories/",
                "/api/cart/",
                "/api/orders/",
                "/api/token/",
                "/admin/",
            ],
        }
    )


urlpatterns = [
    path("", api_root_info, name="api-root-info"),
    path("admin/", admin.site.urls),
    path("api/", include("store.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
