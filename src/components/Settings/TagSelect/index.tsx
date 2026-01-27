import type { OnChangeValue } from 'react-select';
import Select from 'react-select';

interface OptionType {
  value: number;
  label: string;
}

interface TagSelectProps {
  fieldName: string;
  label: string;
  labelTip?: string;
  values: number[];
  onFieldChange: (fieldName: string, value: number[]) => void;
  tags: { id: number; label: string }[];
  isValidated: boolean;
  isTesting: boolean;
  testFirstMessage: string;
  loadingMessage: string;
  selectMessage: string;
  noOptionsMessage: string;
}

const TagSelect: React.FC<TagSelectProps> = ({
  fieldName,
  label,
  labelTip,
  values,
  onFieldChange,
  tags,
  isValidated,
  isTesting,
  testFirstMessage,
  loadingMessage,
  selectMessage,
  noOptionsMessage,
}) => {
  const options = isValidated
    ? tags.map((tag) => ({
        label: tag.label,
        value: tag.id,
      }))
    : [];

  const selectedValues = values
    .map((tagId) => {
      const foundTag = tags.find((tag) => tag.id === tagId);
      if (!foundTag) {
        return undefined;
      }
      return {
        value: foundTag.id,
        label: foundTag.label,
      };
    })
    .filter((option) => option !== undefined) as OptionType[];

  return (
    <div className="form-row">
      <label htmlFor={fieldName} className="text-label">
        {label}
        {labelTip && <span className="label-tip">{labelTip}</span>}
      </label>
      <div className="form-input-area">
        <Select<OptionType, true>
          options={options}
          isMulti
          isDisabled={!isValidated || isTesting}
          placeholder={
            !isValidated
              ? testFirstMessage
              : isTesting
              ? loadingMessage
              : selectMessage
          }
          isLoading={isTesting}
          className="react-select-container"
          classNamePrefix="react-select"
          value={isTesting ? [] : selectedValues}
          onChange={(value: OnChangeValue<OptionType, true>) => {
            onFieldChange(
              fieldName,
              value.map((option) => option.value)
            );
          }}
          noOptionsMessage={() => noOptionsMessage}
        />
      </div>
    </div>
  );
};

export default TagSelect;
