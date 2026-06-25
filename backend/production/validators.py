from rest_framework import serializers

class ProductionValidator:
    @staticmethod
    def validate_initial_material(data):
        from inventory.models import Product, UoM
        from contacts.models import Contact
        try: Product.objects.get(pk=data['component_id'])
        except Product.DoesNotExist: raise serializers.ValidationError({'component_id': 'El componente no existe.'})
        
        if data.get('is_outsourced') and not data.get('supplier_id'):
            raise serializers.ValidationError('Material tercerizado requiere supplier_id.')
            
        if data.get('supplier_id'):
            try: Contact.objects.get(pk=data['supplier_id'])
            except Contact.DoesNotExist: raise serializers.ValidationError({'supplier_id': 'El proveedor no existe.'})
            
        if data.get('uom_id'):
            try: UoM.objects.get(pk=data['uom_id'])
            except UoM.DoesNotExist: raise serializers.ValidationError({'uom_id': 'La unidad de medida no existe.'})
        return data

    @staticmethod
    def validate_bom_line(data):
        from inventory.services import UoMService
        component = data.get('component')
        uom = data.get('uom')
        is_outsourced = data.get('is_outsourced', False)
        
        if component and not component.uom:
            raise serializers.ValidationError(f"El componente '{component.name}' debe tener UoM base.")
            
        if is_outsourced:
            if component and component.product_type != 'SERVICE':
                raise serializers.ValidationError({'component': 'Líneas tercerizadas solo permiten productos Servicio.'})
            if not data.get('supplier'):
                raise serializers.ValidationError({'supplier': 'Seleccione proveedor para servicio tercerizado.'})
            if not data.get('unit_price') or float(data.get('unit_price')) <= 0:
                raise serializers.ValidationError({'unit_price': 'Precio debe ser mayor a 0.'})
                
        if component and uom and not is_outsourced:
            if not UoMService.validate_uom_compatibility(component.uom, uom):
                raise serializers.ValidationError({'uom': 'Unidad no compatible con la categoría del componente.'})
        return data
