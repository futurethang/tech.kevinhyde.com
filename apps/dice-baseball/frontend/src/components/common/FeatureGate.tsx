/**
 * FeatureGate - Conditionally render children based on tier rules.
 *
 * Usage:
 *   <FeatureGate rules={rules} feature="allowPinchHitters">
 *     <PinchHitterButton />
 *   </FeatureGate>
 */

import type { TierProfile } from '../../types';

interface FeatureGateProps {
  rules: TierProfile | undefined;
  feature: keyof TierProfile;
  children: React.ReactNode;
  /** Optional fallback when feature is disabled */
  fallback?: React.ReactNode;
}

export function FeatureGate({ rules, feature, children, fallback = null }: FeatureGateProps) {
  if (!rules || !rules[feature]) {
    return <>{fallback}</>;
  }
  return <>{children}</>;
}
