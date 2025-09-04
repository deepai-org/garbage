
const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `
"""
Social authentication views using dj-rest-auth and django-allauth.

This module provides OAuth endpoints for mobile apps (iOS/Android) that leverage
the existing django-allauth infrastructure for user authentication and session management.
"""

import inspect

from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt, ensure_csrf_cookie
from django.views.decorators.http import require_POST
from rest_framework import status
from rest_framework.response import Response

from allauth.socialaccount.providers.google.views import GoogleOAuth2Adapter
from allauth.socialaccount.providers.oauth2.client import OAuth2Client as _OAuth2Client
from dj_rest_auth.registration.views import SocialLoginView

from infra.system_notifications import system_notification
from infra.user_ip import get_user_ip_from_request


class PatchedOAuth2Client(_OAuth2Client):
    """
    Patched OAuth2Client to fix compatibility between dj-rest-auth and django-allauth.
    
    Issue: dj-rest-auth ≤7.0.1 passes scope/scope_delimiter, but django-allauth ≥0.62
    changed the constructor, causing TypeError for duplicate scope_delimiter.
    
    This patch drops the incompatible arguments before calling the parent constructor.
    Can be removed once dj-rest-auth is updated to handle this.
    """
    def __init__(self, *args, **kwargs):
        sig = inspect.signature(super().__init__)
        # allauth >= 0.62: no 'scope' in __init__
        if 'scope' not in sig.parameters:
            kwargs.pop('scope', None)
        # Defensive: if scope_delimiter was passed positionally, drop kwarg
        if len(args) >= 7 and 'scope_delimiter' in kwargs:
            kwargs.pop('scope_delimiter', None)
        super().__init__(*args, **kwargs)


@ensure_csrf_cookie
@require_POST
def csrf_token(request):
    """
    Endpoint to get a CSRF token for mobile apps.

    Mobile apps should call this first to get a CSRF token,
    then include it in the X-CSRFToken header for subsequent requests.

    Returns:
    {
        "csrftoken": "..."
    }
    """
    return JsonResponse({"csrftoken": get_token(request)})


@method_decorator(csrf_exempt, name="dispatch")
class GoogleLogin(SocialLoginView):
    """
    Google OAuth login for mobile apps (iOS/Android).

    CSRF-exempt endpoint for mobile authentication.

    Expected POST JSON:
    {
        "code": "<serverAuthCode>"  # One-time authorization code from Google Sign-In (ONLY)
    }

    Returns:
    - Sets sessionid cookie for authenticated session
    - Returns user details and auth status

    iOS Setup:
    1. Configure GIDServerClientID with the web client ID
    2. Request serverAuthCode from GIDSignInResult
    3. POST the code to this endpoint

    This view handles:
    - Token exchange with Google
    - User creation or linking via django-allauth
    - Session creation and cookie setting
    - All security checks (audience, issuer, etc.) via the provider

    Note: This endpoint is CSRF-exempt for mobile apps. Web clients should use
    the standard allauth Google login flow instead.
    """
    adapter_class = GoogleOAuth2Adapter
    client_class = PatchedOAuth2Client  # Use patched client to fix scope_delimiter issue
    # Mobile serverAuthCode exchange: use empty redirect_uri per Google docs
    callback_url = ""

    def post(self, request, *args, **kwargs):
        """Override to add logging and IP tracking"""
        ip_addr = get_user_ip_from_request(request)

        # Log the authentication attempt
        system_notification(
            f"Mobile Google auth attempt via dj-rest-auth, IP={ip_addr}"
        )

        # Call parent implementation
        response = super().post(request, *args, **kwargs)

        # Log success if user was authenticated
        if response.status_code == 200:
            user_data = response.data.get('user', {})
            system_notification(
                f"Mobile Google auth successful: user={user_data.get('email', 'unknown')} "
                f"(id={user_data.get('pk', 'unknown')}), IP={ip_addr}"
            )

        return response
`;

console.log('Testing: parses real-world Python Django REST API code');
console.log('Code length:', code.length);

const timeout = setTimeout(() => {
  console.log('TIMEOUT - Parser stuck!');
  process.exit(1);
}, 2000);

try {
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  clearTimeout(timeout);
  
  console.log(`Success! AST body length: ${ast.body.length}`);
} catch (e) {
  clearTimeout(timeout);
  console.log('Parse error:', e.message);
}
