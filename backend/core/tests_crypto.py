"""Tests for core.crypto — ADR 002."""
from django.test import TestCase

from core.crypto import CryptoError, decrypt_secret, encrypt_secret


class CryptoTests(TestCase):
    def test_roundtrip(self):
        token = encrypt_secret("my-secret-api-key")
        self.assertNotEqual(token, "my-secret-api-key")
        self.assertEqual(decrypt_secret(token), "my-secret-api-key")

    def test_empty_token_decrypts_to_empty(self):
        self.assertEqual(decrypt_secret(""), "")

    def test_invalid_token_raises(self):
        with self.assertRaises(CryptoError):
            decrypt_secret("not-a-valid-fernet-token")

    def test_none_plaintext_raises(self):
        with self.assertRaises(CryptoError):
            encrypt_secret(None)

    def test_ciphertext_is_nondeterministic(self):
        # Fernet includes a timestamp + IV, so same input → different output
        self.assertNotEqual(encrypt_secret("x"), encrypt_secret("x"))
