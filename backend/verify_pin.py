import os
import django
import sys

# Add current directory to path to find config
sys.path.append(os.getcwd())

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from core.models import User
from core.services import PINService

def test_pin_logic():
    print("--- PRUEBA DE LÓGICA DE PIN ---")
    
    # 1. Setup test user
    username = "test_pin_user_verify"
    User.objects.filter(username=username).delete()
    user = User.objects.create(username=username, first_name="Test", last_name="Pin")
    
    # Test without PIN
    print("1. Probando usuario sin PIN seteado...")
    assert user.check_pos_pin("1234") == False, "Fallo: Usuario nuevo sin PIN no debería validar nada."
    
    # Set PIN
    print("2. Seteando PIN '4321'...")
    user.set_pos_pin("4321")
    user.save()
    
    # Verify directly
    print("3. Verificando PIN directo...")
    assert user.check_pos_pin("4321") == True, "Fallo: PIN 4321 no valida."
    assert user.check_pos_pin("1111") == False, "Fallo: PIN incorrecto valida."
    
    # Verify through service
    print("4. Verificando a través de PINService...")
    found_user = PINService.validate_pin("4321")
    assert found_user is not None and found_user.username == username, f"Fallo: PINService no encontró al usuario. Encontró: {found_user}"
    
    none_user = PINService.validate_pin("0000")
    assert none_user is None, "Fallo: PINService encontró a alguien con 0000."
    
    # Clean up
    user.delete()
    print("\n✅ TODAS LAS PRUEBAS DE BACKEND PASARON EXITOSAMENTE")

if __name__ == "__main__":
    try:
        test_pin_logic()
    except AssertionError as e:
        print(f"❌ FALLO DE PRUEBA: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"💥 ERROR INESPERADO: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
