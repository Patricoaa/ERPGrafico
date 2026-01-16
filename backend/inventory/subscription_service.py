from django.utils import timezone
from datetime import timedelta
from dateutil.relativedelta import relativedelta
from calendar import monthrange
from decimal import Decimal
from typing import Optional
from .models import Subscription, Product


class SubscriptionService:
    """
    Service for managing subscription-related business logic,
    particularly intelligent date calculation based on payment configuration.
    """
    
    @staticmethod
    def calculate_next_payment_date(subscription: Subscription, from_date=None):
        """
        Calculates the next payment date based on the product's payment configuration.
        
        Supports three modes:
        1. INTERVAL: Every N days from the last payment
        2. FIXED_DAY: Specific day of the month (e.g., day 3 of each month)
        3. Fallback: Uses recurrence_period (MONTHLY, QUARTERLY, etc.)
        
        Args:
            subscription: Subscription instance
            from_date: Optional date to calculate from (defaults to next_payment_date or start_date)
            
        Returns:
            date: The calculated next payment date
        """
        from_date = from_date or subscription.next_payment_date or subscription.start_date
        product = subscription.product
        
        # Case 1: Interval-based (every N days)
        if product.payment_day_type == Product.PaymentDayType.INTERVAL:
            days = product.payment_interval_days or 30
            return from_date + timedelta(days=days)
        
        # Case 2: Fixed day of the month
        elif product.payment_day_type == Product.PaymentDayType.FIXED_DAY:
            # Determine how many months to add based on recurrence_period
            months_delta = {
                Product.RecurrencePeriod.WEEKLY: 0,  # Not applicable for fixed day
                Product.RecurrencePeriod.MONTHLY: 1,
                Product.RecurrencePeriod.QUARTERLY: 3,
                Product.RecurrencePeriod.SEMIANNUAL: 6,
                Product.RecurrencePeriod.ANNUAL: 12,
            }.get(product.recurrence_period, 1)
            
            # Add months to from_date
            next_date = from_date + relativedelta(months=months_delta)
            
            # Adjust to the specific day
            target_day = product.payment_day or 1
            
            try:
                return next_date.replace(day=target_day)
            except ValueError:
                # Day doesn't exist in the month (e.g., day 31 in February)
                # Use the last day of the month instead
                last_day = monthrange(next_date.year, next_date.month)[1]
                return next_date.replace(day=last_day)
        
        # Case 3: Fallback to recurrence_period
        else:
            recurrence_map = {
                Product.RecurrencePeriod.MONTHLY: relativedelta(months=1),
                Product.RecurrencePeriod.QUARTERLY: relativedelta(months=3),
                Product.RecurrencePeriod.ANNUAL: relativedelta(years=1),
                Product.RecurrencePeriod.WEEKLY: relativedelta(weeks=1),
                Product.RecurrencePeriod.SEMIANNUAL: relativedelta(months=6),
            }
            delta = recurrence_map.get(product.recurrence_period, relativedelta(months=1))
            return from_date + delta
    
    @staticmethod
    def is_renewal_due(subscription: Subscription, days_before: int = 7) -> bool:
        """
        Checks if a subscription renewal is due within the specified number of days.
        
        Args:
            subscription: Subscription instance
            days_before: Number of days before next_payment_date to consider "due"
            
        Returns:
            bool: True if renewal is due
        """
        if subscription.status != Subscription.Status.ACTIVE:
            return False
        
        today = timezone.now().date()
        threshold = today + timedelta(days=days_before)
        
        return subscription.next_payment_date <= threshold
