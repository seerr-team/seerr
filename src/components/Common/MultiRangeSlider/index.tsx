import Tooltip from '@app/components/Common/Tooltip';
import useDebouncedState from '@app/hooks/useDebouncedState';
import { useEffect, useRef } from 'react';

type MultiRangeSliderProps = {
  min: number;
  max: number;
  defaultMinValue?: number;
  defaultMaxValue?: number;
  step?: number;
  subText?: string;
  onUpdateMin: (min: number) => void;
  onUpdateMax: (max: number) => void;
};

const MultiRangeSlider = ({
  min,
  max,
  step = 1,
  defaultMinValue,
  defaultMaxValue,
  subText,
  onUpdateMin,
  onUpdateMax,
}: MultiRangeSliderProps) => {
  const touched = useRef(false);
  const [valueMin, finalValueMin, setValueMin] = useDebouncedState(
    defaultMinValue ?? min
  );
  const [valueMax, finalValueMax, setValueMax] = useDebouncedState(
    defaultMaxValue ?? max
  );

  const minThumb = ((valueMin - min) / (max - min)) * 100;
  const maxThumb = ((valueMax - min) / (max - min)) * 100;

  useEffect(() => {
    if (touched.current) {
      onUpdateMin(finalValueMin);
    }
  }, [finalValueMin, onUpdateMin]);

  useEffect(() => {
    if (touched.current) {
      onUpdateMax(finalValueMax);
    }
  }, [finalValueMax, onUpdateMax]);

  useEffect(() => {
    touched.current = false;
    setValueMax(defaultMaxValue ?? max);
    setValueMin(defaultMinValue ?? min);
  }, [defaultMinValue, defaultMaxValue, setValueMax, setValueMin, min, max]);

  return (
    <div className={`relative ${subText ? 'h-8' : 'h-4'} w-full`}>
      <Tooltip
        content={valueMin.toString()}
        tooltipConfig={{
          placement: 'top',
        }}
      >
        <input
          type="range"
          min={min}
          max={max}
          value={valueMin}
          step={step}
          className={`pointer-events-none absolute h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-700 ${
            valueMin >= valueMax && valueMin !== min ? 'z-30' : 'z-10'
          }`}
          onChange={(e) => {
            const value = Number(e.target.value);

            if (value <= valueMax) {
              touched.current = true;
              setValueMin(value);
            }
          }}
        />
      </Tooltip>
      <Tooltip content={valueMax}>
        <input
          type="range"
          min={min}
          max={max}
          value={valueMax}
          step={step}
          className={`pointer-events-none absolute top-0 left-0 right-0 z-20 h-2 w-full cursor-pointer appearance-none rounded-lg bg-transparent`}
          onChange={(e) => {
            const value = Number(e.target.value);

            if (value >= valueMin) {
              touched.current = true;
              setValueMax(value);
            }
          }}
        />
      </Tooltip>
      <div
        className="pointer-events-none absolute top-0 z-30 ml-1 mr-1 h-2 bg-indigo-500"
        style={{
          left: `${minThumb}%`,
          right: `${100 - maxThumb}%`,
        }}
      />
      {subText && (
        <div className="relative top-4 z-30 flex w-full justify-center text-sm text-gray-400">
          <span>{subText}</span>
        </div>
      )}
    </div>
  );
};

export default MultiRangeSlider;
