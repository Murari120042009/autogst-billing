"""
LLM Extractor Module
Calls local Ollama (llama3) for strict JSON extraction.
"""
import subprocess
import json
from typing import Dict, Any
import time

def call_ollama_llm(prompt: str, model: str = "llama3", timeout: int = 20) -> str:
    """
    Calls Ollama LLM with prompt, returns response text.
    Retries once if timeout or invalid JSON.
    """
    for attempt in range(2):
        try:
            proc = subprocess.Popen(
                ["ollama", "run", model],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            try:
                out, err = proc.communicate(prompt, timeout=timeout)
            except subprocess.TimeoutExpired:
                proc.kill()
                if attempt == 0:
                    continue
                raise TimeoutError("Ollama LLM timeout")
            if err:
                raise RuntimeError(f"Ollama error: {err}")
            # Find first JSON object in output
            try:
                start = out.index('{')
                end = out.rindex('}') + 1
                json_str = out[start:end]
                json.loads(json_str)  # Validate
                return json_str
            except Exception:
                if attempt == 0:
                    continue
                raise ValueError("Invalid JSON from LLM")
        except Exception as e:
            if attempt == 1:
                raise e
            time.sleep(1)
    raise RuntimeError("LLM extraction failed")

def llm_extract(structured_text: str, model: str = "llama3") -> Dict[str, Any]:
    """
    Extracts invoice fields using local LLM, returns dict.
    Args:
        structured_text: Text to extract from
        model: Ollama model name
    Returns:
        dict: Structured invoice fields
    """
    prompt = (
        "Extract all invoice fields as strict JSON. "
        "Respond ONLY with JSON.\n"
        f"Text: {structured_text}\n"
    )
    json_str = call_ollama_llm(prompt, model)
    return json.loads(json_str)

if __name__ == "__main__":
    # Example usage
    try:
        out = llm_extract("GSTIN: 22AAAAA0000A1Z5\nInvoice No: INV-1234\nDate: 12/02/2026\nTotal: 1000")
        print(out)
    except Exception as e:
        print("LLM extraction failed:", e)
