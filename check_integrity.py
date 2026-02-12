import sys
import re

def check_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    stack = []
    # Fixed regex: only match tags that start with a letter
    tag_re = re.compile(r'<(/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*)>')
    
    char_stack = []
    
    for i, line in enumerate(lines):
        line_num = i + 1
        
        # Check chars
        # Handle strings and comments roughly
        # This is a simple parser, so we just look for common patterns
        for j, char in enumerate(line):
            if char == '(':
                char_stack.append(('(', line_num, j+1))
            elif char == ')':
                if not char_stack or char_stack[-1][0] != '(':
                    print(f"Mismatch: extra ) at line {line_num}, col {j+1}")
                else:
                    char_stack.pop()
            elif char == '{':
                char_stack.append(('{', line_num, j+1))
            elif char == '}':
                if not char_stack or char_stack[-1][0] != '{':
                    print(f"Mismatch: extra }} at line {line_num}, col {j+1}")
                else:
                    char_stack.pop()
        
        # Check tags (very simple, ignoring comments)
        if '//' in line: 
            line_part = line.split('//')[0]
        else:
            line_part = line
            
        for match in tag_re.finditer(line_part):
            is_closing = match.group(1) == '/'
            tag_name = match.group(2)
            attributes = match.group(3)
            is_self_closing = attributes.strip().endswith('/')
            
            if is_self_closing:
                continue
            
            # Filter common non-JSX matches
            if tag_name in ['any', 'number', 'string']: continue
            
            if is_closing:
                if not stack:
                    print(f"Mismatch: extra closing tag {tag_name} at line {line_num}")
                else:
                    last_tag, last_line, last_col = stack[-1]
                    if last_tag != tag_name:
                        print(f"Mismatch: found </{tag_name}> at {line_num} but expected </{last_tag}> (opened at {last_line})")
                    else:
                        stack.pop()
            else:
                stack.append((tag_name, line_num, match.start()))

    if stack:
        print("Unclosed tags at end of file:")
        for item in stack:
            print(item)
    
    if char_stack:
        print("Unclosed braces/parens at end of file:")
        for item in char_stack:
            print(item)

if __name__ == "__main__":
    if len(sys.argv) > 1:
        check_file(sys.argv[1])
    else:
        print("Usage: python check.py <file>")
