
import requests
import json
import time
import uuid
import logging
from django.conf import settings

logger = logging.getLogger(__name__)

class TuuClient:
    """
    Client for Tuu (Haulmer) Remote Payment API V2.
    Documentation: https://developers.tuu.cl/docs/pago-remoto
    """
    
    BASE_URL = "https://integrations.payment.haulmer.com/RemotePayment/v2"

    def __init__(self, api_key=None, device_id=None):
        self.api_key = api_key
        self.device_id = device_id
        # If no API key is provided, we run in MOCK mode
        self.is_mock = not bool(api_key)

    def create_payment(self, amount, order_id=None, email=None):
        """
        Initiates a payment request.
        Returns a dict with 'idempotencyKey' or 'mock_id'.
        """
        if self.is_mock:
            logger.info(f"[TUU-MOCK] Creating payment for amount {amount}")
            return {
                "success": True,
                "data": {
                    "idempotencyKey": f"mock_{uuid.uuid4()}",
                    "amount": amount,
                    "status": "SENT" # Initial mock status
                }
            }

        url = f"{self.BASE_URL}/Create"
        headers = {
            "X-API-Key": self.api_key,
            "Content-Type": "application/json"
        }
        
        # Idempotency key is required for V2
        idempotency_key = str(uuid.uuid4())
        
        payload = {
            "idempotencyKey": idempotency_key,
            "amount": int(amount),
            "device": self.device_id,
            "dteType": 0, # 0 = Voucher, 33 = Factura, 48 = Boleta. Default to Voucher for now.
             # Extra data can be added here
        }
        
        if order_id:
             # Using custom fields is restricted, but we could put it in reference if needed
             pass

        try:
            response = requests.post(url, json=payload, headers=headers, timeout=10)
            response.raise_for_status()
            return {"success": True, "data": response.json()}
        except requests.exceptions.RequestException as e:
            logger.error(f"Tuu API Error: {str(e)}")
            if e.response:
                return {"success": False, "error": e.response.text}
            return {"success": False, "error": str(e)}

    def get_status(self, idempotency_key):
        """
        Checks the status of a payment.
        """
        if self.is_mock:
            # Simulate processing time based on key creation (implied)
            # For simplicity, we just return success after a simulated delay handled by the frontend polling
            # But here we can just return random or fixed states.
            # Let's assume after creation it goes to PROCESSING then COMPLETED.
            # Since we don't store state in the client, we'll randomize or just return COMPLETED for immediate testing
            # Better: In a real mock, we might want to store this in a temporary dict or valid cache.
            # For now, let's return 'APPROVED' directly to unblock flow, or make it deterministic based on amount?
            logger.info(f"[TUU-MOCK] Checking status for {idempotency_key}")
            return {
                "success": True,
                "data": {
                    "idempotencyKey": idempotency_key,
                    "status": "COMPLETED", # MOCK SUCCESS
                    "responseCode": "00",
                    "responseDescription": "Approved"
                }
            }

        url = f"{self.BASE_URL}/GetPaymentRequest/{idempotency_key}"
        headers = {
            "X-API-Key": self.api_key
        }

        try:
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()
            return {"success": True, "data": response.json()}
        except requests.exceptions.RequestException as e:
            logger.error(f"Tuu Status Error: {str(e)}")
            return {"success": False, "error": str(e)}
