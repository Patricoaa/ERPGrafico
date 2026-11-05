import pytest

from contacts.models import Contact
from contacts.serializers import ContactWriteSerializer


@pytest.mark.django_db
def test_duplicate_tax_id_message_is_spanish_and_field_scoped():
    Contact.objects.create(name="Existente", tax_id="77.777.777-7")

    serializer = ContactWriteSerializer(data={"name": "Nuevo", "tax_id": "77.777.777-7"})

    assert not serializer.is_valid()
    assert serializer.errors["tax_id"][0] == "Ya existe un contacto con este RUT."
