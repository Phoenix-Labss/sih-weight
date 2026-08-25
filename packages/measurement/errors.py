"""Domain errors for exact measurement and legal metrology arithmetic."""

class MeasurementError(Exception):
    """Base exception for all measurement engine domain errors."""
    pass


class InvalidExactDecimalError(MeasurementError, TypeError, ValueError):
    """Raised when an invalid representation or prohibited binary float is passed to ExactDecimal."""
    pass


class IncompatibleUnitError(MeasurementError):
    """Raised when attempting a unit conversion between incompatible physical dimensions."""
    pass


class PrecisionLossError(MeasurementError):
    """Raised when an operation would violate legal metrology precision constraints."""
    pass


class DimensionalityError(MeasurementError):
    """Raised when a dimensional equation or unit dimension is mismatched."""
    pass
