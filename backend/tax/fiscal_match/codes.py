"""Códigos de las reglas y advertencias del cuadre (spec §7c).

Los de las reglas que bloquean una unión manual viajan en el 400 (``error.code``); los de
advertencia (``OTHER_*``) solo los muestra la búsqueda. Módulo sin dependencias: lo
importan ``services`` y ``scoring`` sin depender uno del otro.
"""

TYPE_INCOMPATIBLE = "TYPE_INCOMPATIBLE"
OTHER_DIRECTION = "OTHER_DIRECTION"
PAYMENT_TAKEN = "PAYMENT_TAKEN"
SECOND_DOCUMENT = "SECOND_DOCUMENT"
SECOND_RCV = "SECOND_RCV"
NOT_COMPLETED = "NOT_COMPLETED"
MOVED = "MOVED"
PAYMENT_REQUIRED = "PAYMENT_REQUIRED"
NOT_ALLOWED = "NOT_ALLOWED"
OTHER_DOCUMENT_PAYMENT = "OTHER_DOCUMENT_PAYMENT"
GONE = "GONE"
NOT_FOUND = "NOT_FOUND"
IGNORED_PAYMENT = "IGNORED_PAYMENT"
RCV_HAS_SALES = "RCV_HAS_SALES"

# Advertencias que no bloquean el guardado.
OTHER_AMOUNT = "OTHER_AMOUNT"
OTHER_DAY = "OTHER_DAY"
OTHER_RUT = "OTHER_RUT"
