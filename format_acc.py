import sys
import re
import os
import subprocess

try:
    import jsbeautifier
except ImportError:
    subprocess.run(["pip", "install", "jsbeautifier"], check=True)
    import jsbeautifier

def clean_html_tag(tag):
    """
    Limpia un tag HTML preservando los bloques ACC internos intactos y en una sola línea.
    """
    if '<%' in tag:
        # Extraer bloques ACC y limpiar el resto
        parts = re.split(r'(<%.*?%>)', tag, flags=re.DOTALL)
        cleaned_parts = []
        for part in parts:
            if part.startswith('<%'):
                # Expresiones: <%=, <%@, <%#
                if part.startswith('<%='):
                    cleaned_parts.append('<%= ' + part[3:-2].strip() + ' %>')
                elif part.startswith('<%@'):
                    cleaned_parts.append('<%@ ' + part[3:-2].strip() + ' %>')
                elif part.startswith('<%#'):
                    cleaned_parts.append('<%# ' + part[3:-2].strip() + ' %>')
                else:
                    cleaned_parts.append(part.strip())
            else:
                # Limpiar atributos HTML: un solo espacio entre ellos
                c = re.sub(r'\s+', ' ', part)
                cleaned_parts.append(c)
        
        full = "".join(cleaned_parts)
        # Limpieza final
        full = re.sub(r'^<\s+', '<', full)
        full = re.sub(r'\s+>$', '>', full)
        full = re.sub(r'\s+/>$', ' />', full)
        full = re.sub(r' +', ' ', full).strip()
        return full
    else:
        cleaned = re.sub(r'\s+', ' ', tag)
        cleaned = re.sub(r'^<\s+', '<', cleaned)
        cleaned = re.sub(r'\s+(/?>)$', r'\1', cleaned)
        return cleaned.strip()

def format_js_internal(js_code):
    opts = jsbeautifier.default_options()
    opts.indent_size = 2
    opts.brace_style = "collapse"
    opts.wrap_line_length = 0
    
    code = js_code.strip()
    if not code: return ""
    
    # Unir "else if" que se hayan fragmentado por el split original
    code = re.sub(r'\}\s*else\s+if', '} else if', code)
    
    if len(code) < 100 and "\n" not in code:
        return code
        
    try:
        return jsbeautifier.beautify(code, opts)
    except:
        return code

def format_acc_v8_final_v2(content):
    content = re.sub(r'<\s+([%@])', r'<\1', content)
    content = re.sub(r'([%@])\s+>', r'\1>', content)
    
    # Regex maestro para tokens
    pattern = re.compile(r'(<%.*?%>|<(?:<%.*?%>|[^>])*?>|<!--.*?-->)', re.DOTALL)
    raw_tokens = pattern.split(content)
    
    formatted_output = []
    indent_level = 0
    indent_str = "  "
    
    airy_elements = {'table', 'div', 'style', 'head', 'body', 'center', 'html'}
    
    for i, t in enumerate(raw_tokens):
        if t is None: continue
        is_token = (i % 2 == 1)
        t_strip = t.strip()
        
        if is_token:
            # --- CASO A: BLOQUE ACC <% ... %> ---
            # Aseguramos que no se confunda con un tag que empieza por <
            if t_strip.startswith('<%') and not (t_strip.startswith('<') and not t_strip.startswith('<%')):
                
                # Clasificar tipo de tag ACC
                if t_strip.startswith('<%='):
                    prefix, code_start = '<%=', 3
                elif t_strip.startswith('<%@'):
                    prefix, code_start = '<%@', 3
                elif t_strip.startswith('<%#'):
                    prefix, code_start = '<%#', 3
                else:
                    prefix, code_start = '<%', 2
                
                code = t_strip[code_start:-2].strip()
                
                if prefix == '<%':
                    # Indentación basada en llaves
                    # Si contiene } bajamos nivel ANTES de imprimir
                    if '}' in code and '{' not in code:
                        indent_level = max(0, indent_level - 1)
                    elif '} else' in code or 'else if' in code or 'else {' in code:
                        indent_level = max(0, indent_level - 1)
                    
                    # Aire estratégico para lógica
                    if ('if' in code or 'for' in code) and 'else' not in code:
                        if formatted_output and formatted_output[-1] != "":
                            formatted_output.append("")
                    
                    formatted_js = format_js_internal(code)
                    js_lines = formatted_js.split('\n')
                    
                    if len(js_lines) <= 1:
                        formatted_output.append((indent_str * indent_level) + "<% " + js_lines[0] + " %>")
                    else:
                        formatted_output.append((indent_str * indent_level) + "<%")
                        for jl in js_lines:
                            formatted_output.append((indent_str * (indent_level + 1)) + jl)
                        formatted_output.append((indent_str * indent_level) + "%>")
                    
                    # Subir nivel DESPUÉS de imprimir si abre bloque
                    if '{' in code and '}' not in code:
                        indent_level += 1
                    elif '} else {' in code or 'else {' in code or 'else if' in code:
                        indent_level += 1
                else:
                    # Expresiones de una sola línea limpia
                    formatted_output.append((indent_str * indent_level) + prefix + " " + code + " %>")

            # --- CASO B: TAG HTML ---
            elif t_strip.startswith('<'):
                if t_strip.startswith('<!--'):
                    formatted_output.append((indent_str * indent_level) + t_strip)
                    continue
                    
                is_closing = t_strip.startswith('</')
                tag_name_match = re.search(r'^</?([a-z0-9:-]+)', t_strip, re.I)
                tag_name = tag_name_match.group(1).lower() if tag_name_match else ""
                
                clean_tag = clean_html_tag(t_strip)
                
                if is_closing:
                    indent_level = max(0, indent_level - 1)
                
                if tag_name in airy_elements and not is_closing:
                    if formatted_output and formatted_output[-1] != "":
                        formatted_output.append("")
                
                formatted_output.append((indent_str * indent_level) + clean_tag)
                
                is_void = tag_name in {'img', 'br', 'hr', 'meta', 'link', 'input'} or t_strip.endswith('/>')
                if not is_closing and not is_void:
                    indent_level += 1
            
        else:
            # --- CASO C: TEXTO ---
            text = re.sub(r'\s+', ' ', t).strip()
            if text:
                formatted_output.append((indent_str * indent_level) + text)

    return "\n".join(formatted_output)

def main():
    if len(sys.argv) < 3:
        print("Uso: python format_acc.py <input> <output>")
        return
        
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    
    with open(input_file, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()

    print(f"Generando versión final ultra-legible: {input_file}")
    
    result = format_acc_v8_final_v2(content)
    result = re.sub(r'\n{3,}', '\n\n', result)
    
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(result)
        
    print(f"Proceso completado. Archivo listo: {output_file}")

if __name__ == "__main__":
    main()
