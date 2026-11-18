import React from 'react';
import {
  getDefaultCustomRange,
  PeriodFilterBar as SharedPeriodFilterBar,
  type PeriodFilterBarProps as SharedPeriodFilterBarProps,
} from '@yggdrasil-lab/ui';
import { PERIOD_OPTIONS } from '../constants/categories';
import { PeriodType } from '../types';

export { getDefaultCustomRange };

export type PeriodFilterBarProps = Omit<SharedPeriodFilterBarProps<PeriodType>, 'options'> & {
  options?: SharedPeriodFilterBarProps<PeriodType>['options'];
};

/**
 * Midas period filter bar backed by shared @yggdrasil-lab/ui PeriodFilterBar.
 */
export const PeriodFilterBar: React.FC<PeriodFilterBarProps> = ({
  options = PERIOD_OPTIONS,
  ...rest
}) => <SharedPeriodFilterBar<PeriodType> options={options} {...rest} />;
