from rest_framework import serializers

class ProductValidator:
    @staticmethod
    def parse_request_data(data):
        import json
        from django.http import QueryDict
        ret = data.dict() if isinstance(data, QueryDict) else (data.copy() if hasattr(data, 'copy') else data)
        if isinstance(data, QueryDict):
            for f in ['boms', 'allowed_sale_uoms', 'attribute_values', 'variant_updates', 'variant_generation_selection', 'uom_prices']:
                if f in data: ret[f] = data.getlist(f)
                
        for f in ['boms', 'allowed_sale_uoms', 'attribute_values', 'variant_updates', 'variant_generation_selection', 'uom_prices']:
            if f in ret:
                rv = ret[f]
                if isinstance(rv, list):
                    pl = []
                    for i in rv:
                        if isinstance(i, str):
                            try:
                                pi = json.loads(i)
                                pl.extend(pi) if isinstance(pi, list) else pl.append(pi)
                            except (ValueError, TypeError):
                                pl.append(int(i) if (f in ['allowed_sale_uoms', 'attribute_values'] and i.isdigit()) else i)
                        else: pl.append(i)
                    ret[f] = pl
                elif isinstance(rv, str):
                    try: ret[f] = json.loads(rv)
                    except (ValueError, TypeError):
                        if (f in ['allowed_sale_uoms', 'attribute_values']) and rv.isdigit(): ret[f] = [int(rv)]
                elif rv == '': ret[f] = None
        for k in list(ret.keys()):
            if ret[k] == '': ret[k] = None
        return ret

    @staticmethod
    def validate(data):
        if not data.get('uom'): data['uom'] = data.get('sale_uom') or data.get('purchase_uom')
        uom = data.get('uom')
        if uom:
            su = data.get('sale_uom')
            pu = data.get('purchase_uom')
            if su and su.category != uom.category: raise serializers.ValidationError({'sale_uom': 'Misma categoría que unidad base requerida.'})
            if pu and pu.category != uom.category: raise serializers.ValidationError({'purchase_uom': 'Misma categoría que unidad base requerida.'})
            asu = data.get('allowed_sale_uoms')
            if asu:
                for au in asu:
                    if au.category != uom.category: raise serializers.ValidationError({'allowed_sale_uoms': 'Misma categoría que unidad base requerida.'})
        return data
