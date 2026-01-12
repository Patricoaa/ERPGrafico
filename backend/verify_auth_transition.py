import urllib.request
import urllib.parse
import json
import urllib.error

def get_token():
    url = "http://localhost:8000/api/token/"
    data = json.dumps({"username": "admin", "password": "admin123"}).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req) as response:
            content = response.read().decode('utf-8')
            token = json.loads(content)['access']
            print("Login Successful. Token obtained.")
            return token
    except Exception as e:
        print(f"Login Failed: {e}")
        return None

def create_ot(token):
    # Need a manufacturable product first
    # Just list products and pick one
    url_prod = "http://localhost:8000/api/inventory/products/?product_type=MANUFACTURABLE"
    req = urllib.request.Request(url_prod, headers={'Authorization': f'Bearer {token}'})
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            if isinstance(data, list):
                results = data
            else:
                results = data.get('results', [])
            if not results:
                print("No manufacturable products found.")
                return None
            product_id = results[0]['id']
            print(f"Using Product ID: {product_id}")
            
            # Create Manual OT
            url_create = "http://localhost:8000/api/production/orders/create_manual/"
            payload = {
                "product_id": product_id,
                "quantity": 10,
                "description": "Test Auth OT"
            }
            req_create = urllib.request.Request(url_create, data=json.dumps(payload).encode('utf-8'), 
                                              headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'},
                                              method='POST')
            with urllib.request.urlopen(req_create) as resp_create:
                ot = json.loads(resp_create.read().decode('utf-8'))
                print(f"Created OT: {ot['number']} (ID: {ot['id']})")
                return ot['id']
                
    except Exception as e:
        print(f"Error creating OT: {e}")
        return None

def transition_ot(token, ot_id):
    url = f"http://localhost:8000/api/production/orders/{ot_id}/transition/"
    # Initial stage is MATERIAL_ASSIGNMENT, next is MATERIAL_APPROVAL
    payload = {"next_stage": "MATERIAL_APPROVAL"}
    req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'),
                               headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'},
                               method='POST')
    try:
        with urllib.request.urlopen(req) as resp:
            print("Transition Successful! Status: 200 OK")
            print(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        print(f"Transition Failed: {e.code}")
        print(e.read().decode('utf-8'))
    except Exception as e:
        print(f"Transition Error: {e}")

if __name__ == "__main__":
    token = get_token()
    if token:
        ot_id = create_ot(token)
        if ot_id:
            transition_ot(token, ot_id)
