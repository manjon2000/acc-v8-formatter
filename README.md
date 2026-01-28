# Adobe Campaign Classic V8 Formatter (ACC-V8-Formatter) 🎨

A specialized tool for formatting Adobe Campaign Classic (ACC) V8 HTML templates. It handles the complex mix of standard HTML and embedded Javascript/E4X logic (`<% ... %>`), ensuring clean, readable, and professional code.

## ✨ Features

- **ACC-Aware Formatting**: Doesn't break HTML tags containing dynamic ACC expressions.
- **Master Indentation**: Intelligent 2-space indentation that respects both HTML nesting and Javascript logic blocks.
- **Smart Logic Alignment**: Unified alignment for `if`, `else if`, and `else` blocks across HTML and Javascript.
- **Visual Breathing Room**: Automatically adds strategic vertical spacing (air) before major structural elements like tables and logic blocks.
- **Attribute Cleanup**: Collapses messy, multi-line HTML attributes into clean, single-line tags.
- **E4X Support**: Properly formats the internal ECMA-402 (E4X) syntax used in ACC V8.

## 🚀 Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/your-user/acc-v8-formatter.git
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

## 🛠 Usage

Run the formatter from your terminal:

```bash
python format_acc.py <input_file.html> <output_file.html>
```

### Example:
```bash
python format_acc.py my_template.html formatted_template.html
```

## 📝 Requirements

- Python 3.x
- `jsbeautifier`

## ✅ License

MIT License. Feel free to use and improve it!
