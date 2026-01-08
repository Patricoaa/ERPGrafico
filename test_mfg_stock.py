import urllib.request
import urllib.error
import json

BASE_URL = "http://localhost:8000/api"

def request(method, url, data=None):
    req = urllib.request.Request(url, method=method)
    req.add_header('Content-Type', 'application/json')
    if data:
        req.data = json.dumps(data).encode('utf-8')
    
    try:
        with urllib.request.urlopen(req) as response:
            content = response.read().decode('utf-8')
            try:
                return response.getcode(), json.loads(content)
            except:
                return response.getcode(), content
    except urllib.error.HTTPError as e:
        content = e.read().decode('utf-8')
        try:
            return e.code, json.loads(content)
        except:
            return e.code, content
    except urllib.error.URLError as e:
        print(f"URL Error: {e.reason}")
        return 0, None

def test_manufacturable_no_stock():
    print("Testing Manufacturable Product creation (Stock=False)...")
    
    # 1. Fetch UoM for sale_uom
    code, uoms = request("GET", f"{BASE_URL}/inventory/uom/")
    if not isinstance(uoms, list) or not uoms:
        print("No UoMs found or error:", uoms)
        return
    uom_id = uoms[0]['id']

    # 2. Create Product
    product_data = {
        "name": "Test Mfg No Stock urllib 2",
        "product_type": "MANUFACTURABLE",
        "track_inventory": False,
        "sale_price": "100.00",
        "tax": 1,
        "category": 1,
        "sale_uom": uom_id
    }
    
    code, product = request("POST", f"{BASE_URL}/inventory/products/", product_data)
    if code != 201:
        print("Failed to create product:", product)
        return
    
    print(f"Product created: ID {product['id']}, Name: {product['name']}, Track Inventory: {product['track_inventory']}")
    
    # 3. Fetch valid component
    code, products = request("GET", f"{BASE_URL}/inventory/products/")
    component = next((p for p in products if p['id'] != product['id']), None)
    
    if not component:
        print("No component found.")
        return

    # 4. Create BOM
    print(f"Creating BOM using component {component['id']}...")
    bom_data = {
        "product": product['id'],
        "quantity": 1,
        "lines": [
            {
                "component": component['id'],
                "quantity": 2
            }
        ]
    }
    
    code, bom = request("POST", f"{BASE_URL}/production/bom/", bom_data)
    if code == 201:
        print("SUCCESS: BOM created for Manufacturable product (Stock=False) without Stock UoM.")
    else:
        print("FAILURE: BOM creation failed:", bom)

if __name__ == "__main__":
    test_manufacturable_no_stock()
