with open("system_prompt_debug.txt", "r", encoding="utf-8") as f:
    content = f.read()

lines = content.split("\n")
for i, line in enumerate(lines):
    if "IOBC3109" in line:
        print(f"Line {i+1}: {line}")
