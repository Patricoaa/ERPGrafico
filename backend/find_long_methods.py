import ast

def find_long_methods(filename):
    with open(filename, 'r') as f:
        source = f.read()
    
    tree = ast.parse(source)
    for node in ast.walk(tree):
        if isinstance(node, ast.ClassDef):
            for item in node.body:
                if isinstance(item, ast.FunctionDef):
                    lines = item.end_lineno - item.lineno
                    if lines > 20:
                        print(f"{filename}:{item.lineno} {node.name}.{item.name} has {lines} lines")

import glob
import os

for filename in glob.glob('backend/**/views.py', recursive=True):
    find_long_methods(filename)
