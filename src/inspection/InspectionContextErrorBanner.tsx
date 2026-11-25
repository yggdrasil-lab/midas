import React from 'react';
import { AlertBanner, Button } from '@yggdrasil-lab/ui';

interface InspectionContextErrorBannerProps {
  contextError: string | null;
  retrying?: boolean;
  onRetry: () => void;
}

/**
 * Shared fail-loud banner surfacing loans/accounts context load failures
 * across inspection modals with an inline retry button.
 */
export const InspectionContextErrorBanner: React.FC<InspectionContextErrorBannerProps> = ({
  contextError,
  retrying = false,
  onRetry,
}) => {
  if (!contextError) return null;
  return (
    <div data-testid="inspection-context-error-banner">
      <AlertBanner variant="error">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span>{contextError}</span>
          <Button
            variant="outline"
            size="xs"
            loading={retrying}
            onClick={onRetry}
            data-testid="inspection-context-retry-btn"
          >
            Retry
          </Button>
        </div>
      </AlertBanner>
    </div>
  );
};
