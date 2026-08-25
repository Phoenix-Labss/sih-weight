"""Statutory fee assessment error hierarchy.
"""

class FeeError(Exception):
    """Base exception for fee calculation and policy errors."""
    pass


class InvalidCapacityError(FeeError):
    """Raised when instrument capacity is missing, zero, negative, or invalid."""
    pass


class UnsupportedAccuracyClassError(FeeError):
    """Raised when an unrecognized accuracy class is provided."""
    pass


class InvalidFeePolicyError(FeeError):
    """Raised when a requested fee policy version is unknown or invalid."""
    pass


class FeeCalculationError(FeeError):
    """Raised when fee calculation cannot be completed."""
    pass
