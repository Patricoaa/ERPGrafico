from django.contrib import admin
from .models import ProductCategory, Product, Warehouse, StockMove, UoMCategory, UoM

@admin.register(ProductCategory)
class ProductCategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'parent')

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'category', 'product_type', 'sale_price', 'uom')
    search_fields = ('code', 'name')
    list_filter = ('category', 'product_type')

@admin.register(UoMCategory)
class UoMCategoryAdmin(admin.ModelAdmin):
    list_display = ('name',)

@admin.register(UoM)
class UoMAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'uom_type', 'ratio', 'active')
    list_filter = ('category', 'uom_type', 'active')
