"""Exact decimal and rational arithmetic for legal metrology.

In statutory verification under The Legal Metrology Act, 2009 and The Legal Metrology
(General) Rules, 2011, binary floating-point arithmetic (IEEE 754 float32/float64)
is strictly prohibited due to representation drift and non-deterministic rounding.
This module guarantees 28-digit exact decimal arithmetic with deferred statutory rounding.
"""

from __future__ import annotations

import decimal
from decimal import Decimal, Context, ROUND_HALF_UP
from fractions import Fraction
from typing import Any, Union

from .errors import InvalidExactDecimalError

# Global legal metrology arithmetic context: 28 decimal places with ROUND_HALF_UP
LEGAL_METROLOGY_PRECISION = 28
LEGAL_METROLOGY_ROUNDING = ROUND_HALF_UP

LEGAL_METROLOGY_CONTEXT = Context(
    prec=LEGAL_METROLOGY_PRECISION,
    rounding=LEGAL_METROLOGY_ROUNDING,
    traps=[decimal.DivisionByZero, decimal.Overflow, decimal.InvalidOperation],
)

# Apply context globally as default
decimal.setcontext(LEGAL_METROLOGY_CONTEXT)


NumericType = Union[str, int, Decimal, Fraction, "ExactDecimal"]


class ExactDecimal(Decimal):
    """An immutable exact decimal value for statutory legal metrology calculations.

    Strictly rejects binary floating-point numbers (`float`) to prevent precision drift.
    Preserves scale and supports exact conversion to/from rational `Fraction`.
    """

    def __new__(cls, value: Any = "0", context: Context | None = None) -> ExactDecimal:
        if isinstance(value, float):
            raise InvalidExactDecimalError(
                f"Binary float {value!r} is strictly prohibited in legal metrology calculations "
                "to prevent precision drift. Pass exact str, int, Decimal, or Fraction instead."
            )

        if isinstance(value, Fraction):
            # Compute exact decimal representation within the metrology context
            with decimal.localcontext(context or LEGAL_METROLOGY_CONTEXT) as ctx:
                d_num = Decimal(value.numerator)
                d_den = Decimal(value.denominator)
                dec = ctx.divide(d_num, d_den)
                return super().__new__(cls, dec)

        if isinstance(value, str):
            cleaned = value.strip()
            if not cleaned:
                raise InvalidExactDecimalError("Empty string cannot be converted to ExactDecimal.")
            try:
                return super().__new__(cls, cleaned, context or LEGAL_METROLOGY_CONTEXT)
            except decimal.InvalidOperation as exc:
                raise InvalidExactDecimalError(f"Invalid decimal string representation: {value!r}") from exc

        try:
            return super().__new__(cls, value, context or LEGAL_METROLOGY_CONTEXT)
        except (decimal.InvalidOperation, TypeError) as exc:
            raise InvalidExactDecimalError(f"Cannot construct ExactDecimal from {type(value).__name__}: {value!r}") from exc

    def to_fraction(self) -> Fraction:
        """Convert this exact decimal to an exact rational Fraction."""
        sign, digits, exponent = self.as_tuple()
        if exponent >= 0:
            numerator = int(self)
            return Fraction(numerator, 1)
        scale = -exponent
        # 10 ** scale
        denominator = 10 ** scale
        num_str = "".join(str(d) for d in digits)
        num_int = int(num_str) if num_str else 0
        if sign == 1:
            num_int = -num_int
        return Fraction(num_int, denominator)

    def exact_round(self, scale: int, rounding: str = ROUND_HALF_UP) -> ExactDecimal:
        """Round strictly at the prescribed statutory step endpoint.

        Args:
            scale: Number of decimal places (e.g. 3 for 0.001).
            rounding: Decimal rounding mode, defaults to ROUND_HALF_UP.
        """
        if scale < 0:
            quantum = Decimal("10") ** -scale
        else:
            quantum = Decimal("1") / (Decimal("10") ** scale) if scale > 0 else Decimal("1")
        rounded = self.quantize(quantum, rounding=rounding)
        return ExactDecimal(rounded)

    def to_display_str(self, scale: int | None = None) -> str:
        """Format as a clean decimal string with exact scale preservation."""
        if scale is not None:
            return str(self.exact_round(scale))
        return str(self)

    def scale(self) -> int:
        """Return the number of decimal digits after the decimal point."""
        _, _, exp = self.as_tuple()
        return -exp if exp < 0 else 0


def exact_decimal(value: Any) -> ExactDecimal:
    """Helper factory returning an ExactDecimal instance."""
    if isinstance(value, ExactDecimal):
        return value
    return ExactDecimal(value)


def exact_round(value: NumericType, scale: int, rounding: str = ROUND_HALF_UP) -> ExactDecimal:
    """Statutory rounding helper."""
    d = exact_decimal(value)
    return d.exact_round(scale, rounding=rounding)


def exact_abs(value: NumericType) -> ExactDecimal:
    """Return the exact absolute value."""
    return ExactDecimal(abs(exact_decimal(value)))


def exact_min(*values: NumericType) -> ExactDecimal:
    """Return the minimum among exact decimal values."""
    if not values:
        raise ValueError("exact_min requires at least one argument")
    return ExactDecimal(min(exact_decimal(v) for v in values))


def exact_max(*values: NumericType) -> ExactDecimal:
    """Return the maximum among exact decimal values."""
    if not values:
        raise ValueError("exact_max requires at least one argument")
    return ExactDecimal(max(exact_decimal(v) for v in values))
