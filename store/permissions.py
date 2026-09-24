from rest_framework import permissions


class IsStaffOrReadOnly(permissions.BasePermission):
    """Read-only for anonymous/authenticated users, write access for staff."""

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return bool(request.user and request.user.is_staff)
