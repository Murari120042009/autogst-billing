"""
Recovery & Merge Engine
Merges two invoice attempts, prefers valid and higher confidence.
"""
from typing import Dict, Any, Tuple

def recovery_merge(attempt1: Dict[str, Any], attempt2: Dict[str, Any]) -> Tuple[Dict[str, Any], bool]:
    """
    Merge two invoice attempts, prefer valid, math-consistent, higher confidence.
    Args:
        attempt1: First invoice dict (with validation info)
        attempt2: Second invoice dict (with validation info)
    Returns:
        merged_invoice: The best invoice
        recovery_used: True if merged or fallback used
    """
    def is_valid(inv):
        return inv.get('is_valid', False)
    def conf(inv):
        return inv.get('confidence_score', 0)
    # Prefer valid
    if is_valid(attempt1) and not is_valid(attempt2):
        return attempt1, False
    if is_valid(attempt2) and not is_valid(attempt1):
        return attempt2, True
    # Both valid: prefer higher confidence
    if is_valid(attempt1) and is_valid(attempt2):
        if conf(attempt2) > conf(attempt1):
            return attempt2, True
        return attempt1, False
    # Both invalid: prefer more math-consistent rows
    def math_consistent(inv):
        return -len(inv.get('row_errors', []))
    if math_consistent(attempt2) > math_consistent(attempt1):
        return attempt2, True
    return attempt1, True

if __name__ == "__main__":
    # Example usage
    a1 = {'is_valid': False, 'confidence_score': 0.7, 'row_errors': [{}]*2}
    a2 = {'is_valid': True, 'confidence_score': 0.6, 'row_errors': [{}]}
    merged, used = recovery_merge(a1, a2)
    print(merged, used)
